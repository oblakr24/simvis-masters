import BSUtils as bs
import numpy as np
from mpl_toolkits.mplot3d import Axes3D
import matplotlib.pyplot as plt
from matplotlib import cm
from matplotlib.ticker import LinearLocator, FormatStrFormatter

def getData():
    xs = []
    ys = []
    ps = []
    with open('data/data.txt') as f:
        lines = f.readlines()
        for line in lines:
            splitline = line.replace("\n", "").split(" ")
            xs.append(float(splitline[1]))
            ys.append(float(splitline[2]))
            ps.append(float(splitline[3]))


    xs -= np.min(xs)
    xs /= np.max(xs)

    ys -= np.min(ys)
    ys /= np.max(ys)

    return xs, ys, ps

def createSurfBS():
    deg = 3
    n = 4

    start = 0
    end = 1

    # np.random.seed(15)
    # controls = np.random.randint(-15, 15, size=(n, n))
    # print controls

    # res = 25


    # marg = 6*(end-start)/(1.0*res)
    # x = np.linspace(start + marg, end - marg, res)
    # y = np.linspace(start + marg, end - marg, res)
    x, y, p = getData()

    marg = 1 * (end - start) * 0.01
    us = np.linspace(start - marg, end + marg, n + 1 - deg)
    us = np.insert(us, np.full(deg, 0), 0)
    us = np.append(us, np.full(deg, us[-1]))

    res = 15

    x1 = np.linspace(0, 1, res)
    y1 = np.linspace(0, 1, res)
    X, Y = np.meshgrid(x1, y1)

    # R = np.sqrt(X ** 2 + Y ** 2)
    # Z = np.sin(R)

    # C = controls.flatten()

    bigN = []

    # for a in range(0, res):
    #     for b in range(0, res):
    #         u = x[a]
    #         v = y[b]
    #         N = np.array([np.multiply([getN(us, u, j, deg) for j in range(0, n)], getN(us, v, i, deg)) for i in range(0, n)]).flatten()
    #         bigN.append(N)

    for a in range(0, len(x)):
        u = x[a]
        v = y[a]
        N = np.array([np.outer([bs.calcBasisFn(us, u, j, deg) for j in range(0, n)], bs.calcBasisFn(us, v, i, deg)) for i in
                      range(0, n)]).flatten()

        bigN.append(N)

    # R = np.dot(bigN, C)
    # R = R + np.random.rand(len(R))
    # R = R + X.flatten() ** 2 - 0.5 * Y.flatten() ** 2
    #
    # R1 = np.reshape(R, (res, res))
    #
    # print np.shape(R1)

    R = p
    CFv = np.linalg.lstsq(bigN, R)[0]
    # CF = np.reshape(np.array(CFv), (n, n))

    # CF = np.reshape(np.array(CFv), (n, n))


    RFv = np.dot(bigN, CFv)
    # RF = np.reshape(RFv[::-1], (res, res))
    RF = np.zeros((res, res))
    for i in range(0, res):
        for j in range(0, res):
            RF[j][i] = RFv[i * res + j]
            # X[i][j] = float(i)/


    err = R - RFv
    # for i in range(0, len(R)):
    #     print str(100 * abs(R[i] - RFv[i])) + " | " + str(R[i]) +" | " + str(RFv[i])

    E = 100 * abs(R - RFv)
    avgE = np.average(E)
    maxE = np.max(E)
    print "Number of data points: " + str(len(x))
    print "Average error: " + str(avgE) + " %"
    print "Maximum error: " + str(maxE) + " %"

    fig = plt.figure()
    ax = fig.gca(projection='3d')
    ax.plot_wireframe(X, Y, RF)
    # ax.scatter(X, Y, RF, c='r', label='data')
    ax.scatter(x, y, R, c='r', label='data')
    # ax.scatter(x, y, RFv, c='b', label='data')
    # ax.scatter(x, y, R - RFv, c='b', label='data')
    plt.show()



createSurfBS()
