from bitstring import BitArray
import numpy as np
import struct
import ctypes

# Structure:
# Byte 1: Type:
#   0: 2 x 2 x 2
#   1: 3 x 3 x 3
#   2: 4 x 4 x 4
#   3: 5 x 5 x 5
#   4: 6 x 6 x 6
#   5: 7 x 7 x 7
#   6: 8 x 8 x 8
#   7: 9 x 9 x 9
#   8: constant encoding
#   9: quantization (also needs the bit number - stored in the last two bits - and the number of values)
# Bytes 2 - 5: Local minimum
# Bytes 5 - 8: Local range (not present in constant encoding)
# Bytes 9, 10 - only in case of quantization
# Bytes 9 - ... : Data
#                   - 2 B per control point in case of 0 - 7
#                   - quantization data

def writeUints32(fn, data):
    bits = ""
    for val in data:
        bits += intToBinLE(int(val), 32)
    writeBinary(fn, BitArray('0b' + bits))

def writePositions(fn, positionsFlat):
    posBits = ""
    for pos in positionsFlat:
        posBits += f32LEToBinStr(pos)
    writeBinary(fn, BitArray('0b' + posBits))

def writeBinary(filename, bitArray):
    with open(filename, 'wb') as resFile:
        resFile.write(bitArray.tobytes())

def readBinary(filename):
    return BitArray(filename=filename)

def takeBits(arr, idx, n):
    return arr[idx:idx+n], idx+n

def parseF16(bits):
    packed = struct.pack("H", int(bits, 2))
    return np.frombuffer(packed, dtype=np.float16)[0]


def intToBin(val, n):
    return bin(val)[2:].zfill(n)

def intToBinLE(val, n):
    str = bin(val)[2:].zfill(n)
    return str[24:32] + str[16:24] + str[8:16] + str[:8]

def f32ToBin(val):
    return BitArray('float:32=' + str(val))

def f32LEToBin(val):
    return BitArray('floatle:32=' + str(val))

def f16ToBin(val):
    f16 = '{:016b}'.format(struct.unpack('<H', np.float16(val).tostring())[0])
    return BitArray('0b' + f16)

def f16ToBinStr(val):
    return '{:016b}'.format(struct.unpack('<H', np.float16(val).tostring())[0])

def f32ToBinStr(val):
    str = bin(ctypes.c_int.from_buffer(ctypes.c_float(abs(val))).value)[2:].zfill(31)
    if val < 0.0:
        str = '1' + str
    else:
        str = '0' + str
    return str

def f32LEToBinStr(val):
    str = bin(ctypes.c_int.from_buffer(ctypes.c_float(abs(val))).value)[2:].zfill(31)
    if val < 0.0:
        str = '1' + str
    else:
        str = '0' + str
    return str[24:32] + str[16:24] + str[8:16] + str[:8]

def uintToBin(val, bits):
    return BitArray('uint:' + str(bits) + '=' + str(val))