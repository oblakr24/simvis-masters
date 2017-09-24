import numpy as np

def encode(vals, bits, minV, maxV):
    rangeV = maxV - minV
    if rangeV == 0:
        return minV, maxV, np.zeros(len(vals))
    vals = (pow(2, bits) - 1) * (vals - minV) / rangeV
    return np.round(vals)

def decode(vals, minV, maxV, bits):
    if minV == maxV or bits == 0:
        return np.ones(len(vals)) * minV
    return minV + (vals / (pow(2, bits) - 1)) * (maxV - minV)

def decodeSeries(startVal, minV, maxV, encodedDiffs, bits):
    decodedDiffs = decode(encodedDiffs, minV, maxV, bits)
    decodedVals = np.zeros(len(encodedDiffs)+1)
    decodedVals[0] = startVal
    val = startVal
    for i in range(0, len(decodedVals)-1):
        val -= decodedDiffs[i]
        decodedVals[i+1] = val
    return decodedVals

def getPRange(vals, p):
    pRange = (1 - p) / 2
    idxStart = int(np.floor(pRange * len(vals)))
    idxEnd = int(np.floor((1 - pRange)*len(vals)))
    sortedVals = sorted(vals)
    return [sortedVals[idxStart], sortedVals[idxEnd]]

def getNumBits(eThr):
    return int(np.ceil(np.log2(1 + 0.25/eThr)))

# def iterate(data, eThr):
#     shifted = np.array(data[1:] + [0])
#     data = np.array(data)
#     diffs = (data - shifted)[:-1]
#
#     for bitsNum in range(2, 32):
#         minV, maxV, encodedDiffs = encode(diffs, bitsNum)
#         decodedVals = decodeSeries(data[0], minV, maxV, encodedDiffs, bitsNum)
#         print decodedVals
#         print data
#         E = np.abs(data - decodedVals) / globRange
#
#         if all(e <= eThr for e in E):
#             avgE = 100 * np.average(E)
#             print "average error: " + str(avgE) + " %"
#             print "breaking at " + str(bitsNum) + " bits"
#             break
#
# def compress(data, eThr):
#     ptsNum = len(data[0])
#     steps = len(data)
#     steps = 9
#     startingStep = 1
#     dim = 0
#
#     globRange = 0.1
#     for step in range(3 * startingStep + dim, steps, 3):
#         minMax = getPRange(scalars[step], 0.999)
#         minMaxVals.append(minMax)
#         locRange = minMax[1] - minMax[0]
#         if locRange > globRange:
#             globRange = locRange
#
#     for i in range(0, ptsNum):
#         print i
#         data = []
#         for step in range(3 * startingStep + dim, steps, 3):
#             data.append(scalars[step][i])
#
#         iterate(data, eThr)

def encodeSeries(values, globRange, eThr):
    values -= values[0]

    minV = np.min(values)
    maxV = np.max(values)
    rangeV = maxV - minV

    if rangeV == 0:
        return 0, minV, maxV, np.zeros(len(values))

    rangeRatio = rangeV / globRange
    # print rangeRatio

    bits = getNumBits(eThr / rangeRatio)
    encodedVals = encode(values, bits, minV, maxV)
    return bits, minV, maxV, encodedVals


def compressOnTimeDomain(scalars, encBytes):
    steps = len(scalars)
    numPts = len(scalars[0])

    startingStep = 1
    dim = 0
    dims = 1
    encBits = encBytes * 8

    minMaxVals = []
    globMin = 999999
    globMax = -999999

    eThr = 0.25 / (pow(2, encBits) - 1)

    totalPoints = numPts * (steps - 1)

    for step in range(dims * startingStep + dim, steps, dims):
        minMax = getPRange(scalars[step], 0.999)
        minMaxVals.append(minMax)
        if minMax[0] < globMin:
            globMin = minMax[0]
        if minMax[1] > globMax:
            globMax = minMax[1]

    globRange = globMax - globMin

    totalBits = 0
    for idx in range(0, numPts):
        values = []
        for step in range(dims * startingStep + dim, steps, dims):
            values.append(scalars[step][idx])


        values = np.array(values)
        bits, minV, maxV, encodedVals = encodeSeries(values, globRange, eThr)

        decodedVals = decode(encodedVals, minV, maxV, bits)

        totalBits += bits * len(values)

        # E = np.abs(values - decodedVals) / globRange
        # avgE = np.average(E) * 100
        # print "Values encoded with " + str(bits) + " bits"
        # print "Average error: " + str(avgE) + " %"


    # add the initial values
    totalBits += 32 + 32
    totalBits += numPts * encBits * 2
    totalBits += numPts * 4

    totalBytes = totalBits / 8.0

    print "Total points: " + str(totalPoints)
    print "Total bytes: " + str(totalBytes)
    print "Bits per point: " + str(totalBits / float(totalPoints))