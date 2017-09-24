
import octree
import json
import numpy as np
import random

def getErrs(Pr, P):
    errFraction = 0.2
    if any(np.isnan(Pr)):
        return np.nan, np.nan, np.nan, np.ones(len(P)) * 100
    E = sorted(100 * abs(Pr - P))
    Ef = E[int(round(len(E) * (1-errFraction))):]
    avgE = np.average(E)
    maxE = np.max(E)
    maxEpf = np.average(Ef)
    # for i in range(0, len(Pr)):
    #     print str(Pr[i]) + " " + str(P[i])
    # print "Average error: " + str(avgE) + " %"
    # print "Avg. p0.2 er.: " + str(maxEpf) + " %"
    # print "Maximum error: " + str(maxE) + " %"
    return avgE, maxEpf, maxE, E


def visErrs(E):
    n, bins, patches = plt.hist(E, 200, normed=1, facecolor='green', alpha=0.75)

    # add a 'best fit' line

    plt.xlabel('% error')
    plt.ylabel('Probability')
    # plt.title(r'$\mathrm{Histogram\ of\ IQ:}\ \mu=100,\ \sigma=15$')
    plt.axis([0, 10, 0, 1.96])
    plt.grid(True)

    # plt.show()

def calcBasisFn(us, u, i, deg):
    if deg == 0:
        if us[i] <= u < us[i + 1]:
            return 1
        else:
            return 0

    if us[i + deg] == us[i]:
        f1 = 0
    else:
        f1 = (u - us[i]) / (us[i + deg] - us[i]) * calcBasisFn(us, u, i, deg - 1)
    if us[i + deg + 1] == us[i + 1]:
        f2 = 0
    else:
        f2 = (us[i + deg + 1] - u) / (us[i + deg + 1] - us[i + 1]) * calcBasisFn(us, u, i + 1, deg - 1)

    return f1 + f2

def getNRow(n, u, us, deg):
    return np.array([calcBasisFn(us, u, i, deg) for i in range(0, n)])

def getSum(u, us, P, n, deg):
    return np.sum(np.array([calcBasisFn(us, u, i, deg) * P[i] for i in range(0, n)]))

def quantize(scalars, bits):
    scalars = np.array(scalars).astype(np.float32)
    minV = np.min(scalars)
    scalars -= minV
    maxV = np.max(scalars)
    scalars /= maxV
    bins = float(np.power(2, bits) - 1)
    scalars = np.round(scalars * bins).astype(np.uint8, copy=False)
    return minV, maxV + minV, scalars

def quantDecompress(scalars, minV, rangeV, bits):
    scalars = scalars.astype(np.float32, copy=False)
    bins = float(np.power(2, bits) - 1)
    scalars /= bins
    scalars *= rangeV
    scalars += minV
    return scalars

def getPositions():
    fname = "positions_bg.json"
    with open(fname) as data_file:
        data = json.load(data_file)
    positions = data["data"]  # TODO
    return positions

def getVelocities(idx, coord):
    with open("velocities_bg.json") as data_file:
        dataP = json.load(data_file)
    vScalars = dataP["data"][idx]
    scalars = [vs[coord] for vs in vScalars]
    return scalars

def getAllVelocities():
    scalarsArray = []
    with open("data/velocities_bg.json") as data_file:
        dataP = json.load(data_file)

    for idx in range(0, 10):
        vScalars = dataP["data"][idx]
        for coord in range(0, 3):
            scalars = [vs[coord] for vs in vScalars]
            scalarsArray.append(scalars)

    return scalarsArray

def getAllPressures():
    scalarsArray = []
    with open("data/pressures_bg.json") as data_file:
        dataP = json.load(data_file)
    for idx in range(0, 10):
        scalarsArray.append(dataP["data"][idx])
    return scalarsArray

def getScalars(idx):
    with open("data/pressures_sm.json") as data_file:
        dataP = json.load(data_file)

    scalars = dataP["data"][idx]  # TODO 4
    return scalars

def getPRange(scalars, p):
    scalars = sorted(scalars)
    num05P = int(round(len(scalars) * ((1.0 - p) / 2.0)))
    return scalars[num05P], scalars[len(scalars) - 1 - num05P]

def getNodeValues(node):
    x = []
    y = []
    z = []
    I = []

    vals = node.values

    for val in vals:
        pos = val[0]
        x.append(pos[0])
        y.append(pos[1])
        z.append(pos[2])
        I.append(val[1])

    x = np.array(x)
    y = np.array(y)
    z = np.array(z)
    I = np.array(I)

    if len(x) > 1:

        x -= x.min()
        x /= x.max()

        y -= y.min()
        y /= y.max()

        z -= z.min()
        z /= z.max()

    return x, y, z, I

def getNodeData(node, scalars):
    x = []
    y = []
    z = []
    p = []

    vals = node.values

    for val in vals:
        pos = val[0]
        x.append(pos[0])
        y.append(pos[1])
        z.append(pos[2])
        pr = scalars[val[1]]
        p.append(pr)

    x = np.array(x)
    y = np.array(y)
    z = np.array(z)
    p = np.array(p)

    pmin = p.min()
    range = 0
    if len(x) > 1:
        range = p.max() - pmin
        p -= pmin
        pmax = p.max()
        if pmax != 0.0:
            p /= pmax

        x -= x.min()
        x /= x.max()

        y -= y.min()
        y /= y.max()

        z -= z.min()
        z /= z.max()

    return x, y, z, p, pmin, range


def subdivide(positions):

    MAXV = float('inf')
    MINV = -float('inf')

    xmax = MINV
    xmin = MAXV
    ymax = MINV
    ymin = MAXV
    zmax = MINV
    zmin = MAXV

    for point in positions:
        if point[0] < xmin:
            xmin = point[0]
        if point[0] > xmax:
            xmax = point[0]

        if point[1] < ymin:
            ymin = point[1]
        if point[1] > ymax:
            ymax = point[1]

        if point[2] < zmin:
            zmin = point[2]
        if point[2] > zmax:
            zmax = point[2]

    xc = (xmax + xmin) / 2
    yc = (ymax + ymin) / 2
    zc = (zmax + zmin) / 2

    tree = octree.Octree(xmax, ymax, zmax, xmin, ymin, zmin, (xc, yc, zc), 7)

    for i in range(0, len(positions)):
        tree.addItem(i, positions[i])

    # return tree.getLeafNodes()
    return tree.getNodesWithAvgChildCount(900)

def getN3(us, u, i):
    if us[i] <= u < us[i + 1]:
        return (1.0 / 6) * u*u*u
    elif us[i + 1] <= u < us[i + 2]:
        return - (1.0 / 2) * u * u * u + 2 * u * u - 2 * u + 2.0 / 3
    elif us[i + 2] <= u < us[i + 3]:
        return (1.0 / 2) * u * u * u - 4 * u * u + 10 * u - 22.0 / 3
    elif us[i + 3] <= u < us[i + 4]:
        return - (1.0/6) * u*u*u + 2 * u*u - 8 * u + 32.0/3
    else:
        return 0

def getN1(us, u, i, nf):
    if us[i] <= u < us[i + 1]:
        return nf * (u - us[i])
    elif us[i + 1] <= u < us[i + 2]:
        return - nf * (u - us[i + 1]) + 1
    else:
        return 0


# region Visualization

def fit1D():
    start = 0
    end = 1
    res = 100

    deg = 1

    # P = [7, 8, 3, 6, 7, 6, 8, 3, 4, 5]
    n = 10  # len(P)

    us = np.linspace(start, end, n + 1 - deg)   # [0, 1, 2, 3, 4, 5, 6, 7]
    us = np.insert(us, np.full(deg, 0), 0)
    us = np.append(us, np.full(deg, us[-1]))


    x = np.linspace(start + 1/res, end-(1.0/res), res)
    y = [0.5*random.random() + 2*xi - (-1+xi)*xi + 0.1*(xi)*(xi)*(xi) for xi in x]

    # x = [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1.0]
    # y = [3, 4, 6.4, 7.5, 7, 5.5, 5, 6, 8, 8.3, 7.5]
    # y = [3, 4, 6.4, 7.2, 7.4, 7.5, 7.8, 8.0, 8.2, 8.3, 7.5]


    X = np.row_stack([getNRow(n, x[i], us, deg) for i in range(0, len(x))])

    # y = np.dot(X, P)
    # y = np.subtract(y, np.multiply(np.random.rand(len(y)), 5))



    P = np.linalg.lstsq(X, y)[0]


    M = 0.5 * np.matrix('1 1 0; -2 2 0; 1 -2 1')

    print us

    ym = []
    for i in range(0, len(x)):
        xi = x[i]

        sum = 0.0
        for k in range(0, n):
            N = calcBasisFn(us, xi, k, deg)
            N2 = getN1(us, xi, k, n-1)

            print str(xi) + " | " + str(k) + " | " + str(N) + " | " + str(N2)

            sum += N2 * P[k]

        # vec = np.array([1, xi, xi*xi])
        #
        # # vecM = (vec * M).tolist()[0]
        #
        # vecM = np.multiply(vec, M)
        #
        # sum = 0.0
        # for k in range(0, len(P) - 3):
        #     Pk = np.array([P[k], P[k+1], P[k+2]])
        #
        #
        #     sum += np.dot(vecM, Pk)
        #

        ym.append(sum)


    yh = np.dot(X, P)

    plt.plot(x, y, 'r')
    plt.plot(x, yh, 'b')
    plt.plot(x, ym, 'k')
    # plt.scatter(us[deg-1:-deg+1], P, c='b', marker='o')
    plt.show()

def getPoints():
    fname = "pts_small.txt"
    # fname = "pts2.txt"

    with open(fname) as f:
        lines = f.readlines()

        x = []
        y = []
        z = []
        p = []

        for line in lines:
            pts = line.split(" ")
            x.append(float(pts[1]))
            y.append(float(pts[2]))
            z.append(float(pts[3]))
            p.append(float(pts[4]))

    x = np.array(x)
    y = np.array(y)
    z = np.array(z)
    p = np.array(p)

    p -= p.min() - 0.01  # TODO
    p /= p.max()

    x -= x.min()
    x *= 1.0 / x.max()

    y -= y.min()
    y *= 1.0 / y.max()

    z -= z.min()
    z *= 1.0 / z.max()

    return x, y, z, p

def getData():
    fname = "points.txt"

    with open(fname) as f:
        lines = f.readlines()

        x = []
        y = []
        p = []

        for line in lines:
            pts = line.split(" ")
            x.append(float(pts[0]))
            y.append(float(pts[1]))
            p.append(float(pts[2]))

    x = np.array(x)
    y = np.array(y)
    p = np.array(p)

    p -= p.min() - 0.01
    p /= p.max()

    x -= x.min()
    x *= 1.0 / x.max()

    y -= y.min()
    y *= 1.0 / y.max()

    return x, y, p

# endregion

