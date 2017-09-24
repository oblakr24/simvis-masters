
import BSUtils
import BinUtils as bin
import numpy as np
import math
from bitstring import BitArray
import time

def compress(leaves, scalarsArray, bytesPerPoint, onlyQuant, verbose=False):
    dataArray = []
    totalBitsCount = 3 + 1 + 8
    totalBitsQuantCount = totalBitsCount

    bins = np.power(2, bytesPerPoint * 8) - 1
    errThr = 100 * 0.25 / bins

    scalarIdx = 0
    for scalars in scalarsArray:
        if verbose:
            print "Compressing scalars " + str(scalarIdx+1) + "/" + str(len(scalarsArray))
        scalarIdx += 1
        encodedData = []

        start = time.time()

        gMin, gMax = BSUtils.getPRange(scalars, 0.999)
        globalRange = gMax - gMin

        binWidth = globalRange / bins
        avgErrWidth = binWidth * 0.25

        totalPts = 0
        totalBits = 0
        totalBitsQuant = 0
        E = []
        for i in range(0, len(leaves)):
            leaf = leaves[i]
            if verbose:
                print str(i) + " | ------------- Leaf with " + str(leaf.childCount) + " points ... -------------"
            # count the bytes needed
            totalPts += leaf.childCount
            totalBits += 2 + 64  # range of values plus model length
            totalBitsQuant += 2 + 64

            # the compressed data about the region
            regionData = {}

            # get the node data
            x, y, z, p, locMin, locRange = BSUtils.getNodeData(leaf, scalars)

            regionData["min"] = locMin
            regionData["range"] = locRange

            if locRange * 0.25 > avgErrWidth:  # (locRange / float(globalRange)) > (errThr / 100.0):
                rangeRatio = min(locRange / float(globalRange), 1.0)
                localErrThr = errThr / rangeRatio
                localBPP = math.ceil(math.log((0.25/(localErrThr/100.0)) + 1.0, 2)) / 8.0  #  max(math.ceil(bytesPerPoint * 8 * rangeRatio), 1.0) / 8.0
                if verbose:
                    print "Range: " + str(rangeRatio * 100) + " % of global range"
                    print "Local desired error: " + str(localErrThr) + "%, BPP: " + str(localBPP)

                if not onlyQuant:
                    solutionFound, C, avgE, E_r = iterateCompressRegion(x, y, z, p, localErrThr, localBPP, verbose)
                else:
                    solutionFound = False

                totalBitsQuant += 4
                totalBitsQuant += leaf.childCount * (localBPP * 8)
                if solutionFound:
                    regionData["type"] = "BS"
                    regionData["data"] = C
                    regionData["BPP"] = localBPP

                    for e in E_r:
                        E.append(e * rangeRatio)
                    totalBits += len(C) * 16
                    totalBits += 5
                else:
                    regionData["type"] = "Q"
                    regionData["data"] = BSUtils.quantize(p, localBPP * 8)
                    regionData["BPP"] = localBPP
                    totalBits += 4
                    totalBits += leaf.childCount * (localBPP * 8)
                    quantErr = 25 * (1.0 / (pow(2, localBPP * 8) - 1)) * rangeRatio
                    for e_i in range(0, leaf.childCount):
                        E.append(quantErr)
            else:
                regionData["type"] = "C"
                totalBits += 0  # no extra bytes needed
                totalBitsQuant += 0
                if verbose:
                    print locRange
                    print globalRange
                    print "The local range is very small - encoding as a constant"

            encodedData.append(regionData)

        dataArray.append(encodedData)

        if verbose:
            print "--------------------------------------------------------------------"

        if len(E) == 0:
            E = [0.0]
        totalBytes = totalBits / 8.0
        totalBytesQuant = totalBitsQuant / 8.0
        avgBPP = totalBytes / (1.0 * totalPts)
        avgBPPQ = totalBytesQuant / (1.0 * totalPts)
        if verbose:
            print "Desired error: " + str(errThr)
            print "Total average error: " + str(np.average(E))
            # print "Total points: " + str(totalPts)
            # print "Total bytes: " + str(totalBytes)
            print "Bytes per point: " + str(avgBPP)
            print "Bytes per point (only quantisation): " + str(avgBPPQ)
            print "Ratio: " + str(avgBPP / avgBPPQ)

            end = time.time()
            print "Total time: " + str(end - start) + "s"


        totalBitsCount += totalBits
        totalBitsQuantCount += totalBitsQuant

    print "--------------------------------------------------------------------"
    print "Total bytes: " + str(totalBitsCount / 8.0)
    print "Total bytes (quantization): " + str(totalBitsQuantCount / 8.0)
    print "Bits per point: " + str(totalBitsCount / (totalPts * len(scalarsArray)))
    print "Bits per point (quant.): " + str(totalBitsQuantCount / (totalPts * len(scalarsArray)))
    print "Ratio: " + str(totalBitsCount / totalBitsQuantCount)

    return dataArray

def getStartingPreset(numPts):
    if numPts < 129:
        return 1
    else:
        return 2

def getOptimalSettings(numPts, setting=None):
    THR0 = 16 + 1
    THR1 = 54 + 1
    THR2 = 128 + 1
    THR3 = 250 + 1
    THR4 = 432 + 1
    THR5 = 688 + 1
    THR6 = 1024 + 1
    THR7 = 1458 + 1
    if setting is None:
        if numPts < THR0:
            setting = 0
        elif numPts < THR1:
            setting = 1
        elif numPts < THR2:
            setting = 2
        elif numPts < THR3:
            setting = 3
        elif numPts < THR4:
            setting = 4
        elif numPts < THR5:
            setting = 5
        elif numPts < THR6:
            setting = 6
        elif numPts < THR7:
            setting = 7
        else:
            setting = 0

    return {
        0: (0, 0),  # special case
        1: (1, 2),  # 8 -> 16B
        2: (2, 3),  # 27 -> 54B
        3: (3, 4),  # 64 -> 128B
        4: (3, 5),  # 125 -> 250B
        5: (3, 6),  # 216 -> 432B
        6: (3, 7),  # 343 -> 688B
        7: (3, 8),  # 512 -> 1024B
        8: (3, 9),  # 729 -> 1458B
    }.get(setting, (-1, -1))

def iterateCompressRegion(x, y, z, p, errThr, bytesPerPoint, verbose=False):
    numPts = len(x)
    if verbose:
        print "Number of data points: " + str(len(x))
    # try with the initial 'low' preset
    preset = getStartingPreset(numPts)
    solutionFound = False
    C = None
    avgE = None
    E = None
    numCPts = 0
    while True:
        deg, n = getOptimalSettings(numPts, preset)
        if deg < 1:
            if verbose:
                print "Too many iterations tried, ending ... "
            break
        # break if number of control points is too large
        numCPts = n * n * n
        if verbose:
            print "Number of control points: " + str(numCPts)

        if numCPts * 2 > numPts * bytesPerPoint:
            if verbose:
                print str(numCPts) + " is too many for " + str(numPts) + " points - breaking."
            break

        # try the current preset
        C, avgE, maxE, maxEpf, E = compressRegion(x, y, z, p, deg, n)

        if verbose:
            print "Avg. error: " + str(avgE) + " %"

        # if error is far too large, break
        if avgE > 7 * errThr or np.isnan(avgE):
            if verbose:
                print "Error too large to continue, likely a Float16 range problem."
            break

        # if error is suitable, break
        if avgE < errThr:
            solutionFound = True
            break

        # otherwise, go to the next preset
        if avgE > 3 * errThr:
            preset += 3
        elif avgE > 2 * errThr:
            preset += 2
        else:
            preset += 1
        # preset += 1

    if solutionFound:
        bytesPerPoint = round((numCPts * 2.0) / numPts, 3)
        if verbose:
            print "Solution found: " + str(numCPts) + " control points for " + str(bytesPerPoint) + " B per point."
    else:
        if verbose:
            print "A suitable B-Spline solution was not found - need to quantize the values."

    return solutionFound, C, avgE, E

numSamples = 400

Ns_cached = {}

def getN(deg, n):
    key = str(deg) + "_" + str(n)
    if key not in Ns_cached:
        start = 0
        end = 1
        marg = 1 * (end - start) * 0.01
        us = np.linspace(start - marg, end + marg, n + 1 - deg)
        us = np.insert(us, np.full(deg, 0), 0)
        us = np.append(us, np.full(deg, us[-1]))

        NS = np.zeros((n, numSamples))
        sampleXs = np.linspace(0, 1.0, numSamples)
        for k in range(0, n):
            for i in range(0, numSamples):
                NS[k][i] = BSUtils.calcBasisFn(us, sampleXs[i], k, deg)

        Ns_cached[key] = NS

    return Ns_cached[key]

def constructX(x, y, z, deg, n):
    NS = getN(deg, n)

    # def getNcol(x):
    #     idx = np.floor(x * (numSamples - 1))
    #     return NS[:, idx]

    X = np.zeros((len(x), n * n * n))
    for i in range(0, len(x)):
        # u = x[i]
        # v = y[i]
        # w = z[i]
        X[i] = np.outer(np.outer(NS[:, np.floor(y[i] * (numSamples - 1))], NS[:, np.floor(x[i] * (numSamples - 1))]).flatten(), NS[:, np.floor(z[i] * (numSamples - 1))]).flatten()
    return X

def decompressRegion(x, y, z, deg, n, C, minV, rangeV):
    X = constructX(x, y, z, deg, n)
    Pr = np.dot(X, C)

    Pr *= rangeV
    Pr += minV
    return Pr

def compressRegion(x, y, z, p, deg, n):
    X = constructX(x, y, z, deg, n)

    C = np.linalg.lstsq(X, p)[0]
    C = C.astype(np.float16, copy=False)

    Pr = np.dot(X, C)

    avgE, maxEpf, maxE, E = BSUtils.getErrs(Pr, p)

    return C, avgE, maxE, maxEpf, E

def BSDecompress(positions, encodedData, leaves):

    start = time.time()

    decoded = np.zeros(len(positions))

    for i in range(0, len(encodedData)):
        encRegion = encodedData[i]
        leaf = leaves[i]
        type = encRegion["type"]
        minV = encRegion["min"]
        rangeV = encRegion["range"]

        values = leaf.values

        if type == "BS":  # B-Spline
            C = encRegion["data"]
            n = int(round(len(C)**(1./3.)))
            deg = 3
            if n == 2:
                deg = 1
            elif n == 3:
                deg = 2

            x, y, z, I = BSUtils.getNodeValues(leaf)
            decomp = decompressRegion(x, y, z, deg, n, C, minV, rangeV)

            for j in range(0, len(I)):
                decompVal = decomp[j]
                decoded[I[j]] = decompVal

        elif type == "Q":  # Quantization
            BPP = encRegion["BPP"] * 8
            _min, _max, scalars = encRegion["data"]
            decomp = BSUtils.quantDecompress(scalars, minV, rangeV, BPP)
            for j in range(0, len(values)):
                idx = values[j][1]
                decompVal = decomp[j]
                decoded[idx] = decompVal

        elif type == "C":  # Constant value
            for j in range(0, len(values)):
                idx = values[j][1]
                decompVal = minV + 0.5 * rangeV
                decoded[idx] = decompVal


    end = time.time()
    print "Total time (decompress): " + str(end - start) + "s"

    return decoded

def convertEncodedData(encodedDatas, depth, is3D, count):
    bitStr = ""
    # write the octree depth bits
    bitStr += bin.intToBin(depth, 3)
    # write the data dimensions
    bitStr += bin.intToBin(is3D, 1)
    # write the length of datas
    bitStr += bin.intToBin(count, 8)
    for encodedData in encodedDatas:
        for encRegion in encodedData:
            type = encRegion["type"]
            minV = encRegion["min"]
            rangeV = encRegion["range"]

            type_b2 = 0  # 2 bits for the byte
            datalen_b = None
            data_b = None
            bitsPerPoint_b = None

            minv_b32 = bin.f32ToBinStr(minV)
            rangev_b32 = bin.f32ToBinStr(rangeV)

            if type == "BS":  # B-Spline
                type_b2 = 0
                C = encRegion["data"]
                n = int(round(len(C)**(1./3.)))

                # 5 bits for n
                datalen_b = bin.intToBin(n, 5)

                # construct the data bits
                data_b = ""
                for cVal in C:
                    data_b += bin.f16ToBinStr(cVal)

            elif type == "Q":  # Quantization
                type_b2 = 1
                bitsPerPoint = int(math.ceil(encRegion["BPP"] * 8))
                bitsPerPoint_b = bin.intToBin(bitsPerPoint, 4)

                _min, _max, values = encRegion["data"]

                # construct the data bits
                data_b = ""
                for val in values:
                    data_b += bin.intToBin(val, bitsPerPoint)

            elif type == "C":  # Constant value
                type_b2 = 2

            # write the type bits
            bitStr += bin.intToBin(type_b2, 2)
            # write the minimum value bytes
            bitStr += minv_b32
            # write the values range bytes
            bitStr += rangev_b32
            # write the length bits, if available
            if datalen_b is not None:
                bitStr += datalen_b
            # write the bits per point, if available
            if bitsPerPoint_b is not None:
                bitStr += bitsPerPoint_b
            # write the data bits, if available
            if data_b is not None:
                bitStr += data_b

    return BitArray('0b' + bitStr)

def parseCompressedBits(dataBits, leaves, positions):

    decodedVals = []

    idx = 0

    # depth, is3D, data len bits
    depthBits, idx = bin.takeBits(dataBits, idx, 3)
    is3DBits, idx = bin.takeBits(dataBits, idx, 1)
    stepsBits, idx = bin.takeBits(dataBits, idx, 8)

    is3D = is3DBits.uint == 1
    steps = stepsBits.uint

    for i in range(0, steps):
        decodedValsStep = []
        dim = 1
        if is3D:
            dim = 3

        for j in range(0, dim):
            decodedValsDim = np.zeros(len(positions))

            for r in range(0, len(leaves)):
                leaf = leaves[r]
                idx = parseCompressedBitsRegion(dataBits, idx, leaf, decodedValsDim)

            decodedValsStep.append(decodedValsDim)

        if is3D:
            decodedVals.append(decodedValsStep)
        else:
            decodedVals.append(decodedValsStep[0])

    return decodedVals, steps, is3D

def parseCompressedBitsRegion(dataBits, idx, leaf, decodedVals):

    typeBits, idx = bin.takeBits(dataBits, idx, 2)
    typeInt = typeBits.uint


    minVBits, idx = bin.takeBits(dataBits, idx, 32)
    rangeVBits, idx = bin.takeBits(dataBits, idx, 32)

    minV = minVBits.float
    rangeV = rangeVBits.float
    # print str(minVBits.bin) #bin.parseF16(minVBits.bin)

    if typeInt == 0:
        # B-Spline
        dataLenBits, idx = bin.takeBits(dataBits, idx, 5)
        n = dataLenBits.uint

        C = np.zeros(n*n*n)
        for i in range(0, n * n * n):
            cValBits, idx = bin.takeBits(dataBits, idx, 16)
            C[i] = bin.parseF16(cValBits.bin)

        deg = 3
        if n == 2:
            deg = 1
        elif n == 3:
            deg = 2

        x, y, z, I = BSUtils.getNodeValues(leaf)
        decomp = decompressRegion(x, y, z, deg, n, C, minV, rangeV)

        for j in range(0, len(I)):
            decompVal = decomp[j]
            decodedVals[I[j]] = decompVal


    elif typeInt == 1:
        # Quantization
        numOfValues = len(leaf.values)

        bitsPerPointBits, idx = bin.takeBits(dataBits, idx, 4)
        bitsPerPoint = bitsPerPointBits.uint

        vals = np.zeros(numOfValues)
        for i in range(0, numOfValues):
            valBits, idx = bin.takeBits(dataBits, idx, bitsPerPoint)
            vals[i] = valBits.uint

        decomp = BSUtils.quantDecompress(vals, minV, rangeV, bitsPerPoint)
        for j in range(0, len(leaf.values)):
            valIdx = leaf.values[j][1]
            decompVal = decomp[j]
            decodedVals[valIdx] = decompVal

    elif typeInt == 2:
        # Constant
        for j in range(0, len(leaf.values)):
            valIdx = leaf.values[j][1]
            decompVal = minV + 0.5 * rangeV
            decodedVals[valIdx] = decompVal


    return idx


def testCompression():
    start = time.time()

    scalarsArray = BSUtils.getAllVelocities()
    # scalarsArray = BSUtils.getAllPressures()
    positions = BSUtils.getPositions()
    leaves, depth = BSUtils.subdivide(positions)
    encodedDatas = compress(leaves, scalarsArray, 0.75, True, False)

    # for i in range(0, len(encodedDatas)):
    #     encodedData = encodedDatas[i]
    #     scalars = scalarsArray[i]
    #     scalarsDecoded = BSDecompress(positions, encodedData, leaves)
    #
    #     gMin, gMax = BSUtils.getPRange(scalars, 0.999)
    #     gRange = max(gMax - gMin, 0.000001)
    #
    #     E = 100.0 * abs(scalars - scalarsDecoded) / gRange
    #
    #     bins = 255.0
    #     binW = gRange / bins
    #     maxErr = 100.0 * (0.5 * binW) / gRange
    #     avgErr = 0.5 * maxErr
    #
    #     mE = max(E)
    #     aE = np.average(E)
    #
    #     print " ---------------------------------"
    #     print "Total points: " + str(len(positions))
    #     print "These should be the errors: "
    #     # print gRange
    #     # print binW
    #     print maxErr
    #     print avgErr
    #
    #     print "Actual: "
    #     print mE
    #     print aE


    print "Total time (compression): " + str(time.time() - start) + "s"

    start = time.time()

    dataBits = convertEncodedData(encodedDatas, depth, 0, 10)

    print "Total time (conversion to binary): " + str(time.time() - start) + "s"
    start = time.time()

    print len(dataBits)
    print len(dataBits)/8.0

    fn = "allvells_1.b"

    bin.writeBinary(fn, dataBits)

    print "Total time (writing): " + str(time.time() - start) + "s"


# fn = "comprbin.b"
#
# dataBits = bin.readBinary(fn)
#
# print len(dataBits)
# print len(dataBits) / 8.0
#
# decodedValsArray, steps, is3D = parseCompressedBits(dataBits, leaves, positions)
#
# for i in range(0, steps):
#
#     dim = 1
#     if is3D:
#         dim = 3
#
#     for j in range(0, dim):
#         scalars = scalarsArray[i][j]
#         if is3D:
#             decodedVals = decodedValsArray[i][j]
#         else:
#             decodedVals = decodedValsArray[i]
#
#         rangeMin, rangeMax = BSUtils.getPRange(scalars, 0.999)
#         globRange = rangeMax - rangeMin
#
#         E = 100.0 * np.abs(scalars - decodedVals) / globRange
#         print "Testing scalars at step " + str(i) + " on dimension " + str(j)
#         print np.average(E)
#         print np.max(E)