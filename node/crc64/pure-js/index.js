/**
 * Kaidi ZHU <zhukaidi@souche.com> created at 2017-09-07 16:02:19 with ❤
 *
 * Copyright (c) 2017 Souche.com, all rights reserved.
 */
"use strict";

const fs = require("fs");

const binding = require("./crc");

const raw = {
  crc64: binding.cwrap("crc64", "null", ["number", "number", "number"]),
  crc64Init: binding.cwrap("crc64_init", "null", []),
  strToUint64Ptr: binding.cwrap("str_to_uint64", "null", ["number", "number"]),
  uint64PtrToStr: binding.cwrap("uint64_to_str", "null", ["number", "number"]),
};

raw.crc64Init();

function strToUint64Ptr(str) {
  const strPtr = binding._malloc(str.length + 1);
  binding.stringToUTF8(str, strPtr, str.length + 1);

  const uint64Ptr = binding._malloc(8);
  raw.strToUint64Ptr(strPtr, uint64Ptr);
  binding._free(strPtr);

  return uint64Ptr;
}

function uint64PtrToStr(uint64Ptr) {
  const strPtr = binding._malloc(32);
  raw.uint64PtrToStr(strPtr, uint64Ptr);
  const str = binding.UTF8ToString(strPtr);
  binding._free(strPtr);
  return str;
}

function buffToPtr(buff) {
  if (typeof buff === "string") {
    buff = new Buffer(buff);
  } else if (!Buffer.isBuffer(buff)) {
    throw new Error("Invalid buffer type.");
  }

  const buffPtr = binding._malloc(buff.length);
  binding.writeArrayToMemory(buff, buffPtr);

  return buffPtr;
}

module.exports.crc64 = function (buff, prev) {
  if (!prev) prev = "0";
  if (typeof prev !== "string" || !/\d+/.test(prev)) {
    throw new Error("Invlid previous value.");
  }

  const prevPtr = strToUint64Ptr(prev);
  const buffPtr = buffToPtr(buff);

  raw.crc64(prevPtr, buffPtr, buff.length);
  const ret = uint64PtrToStr(prevPtr);

  binding._free(prevPtr);
  binding._free(buffPtr);

  return ret;
};

module.exports.crc64File = function (filename, callback) {
  let errored = false;
  const stream = fs.createReadStream(filename);
  const crcPtr = strToUint64Ptr("0");
  let crcPtrFreed = false;
  stream.on("error", function (err) {
    errored = true;
    stream.destroy();
    if (!crcPtrFreed) {
      binding._free(crcPtr);
      crcPtrFreed = true;
    }
    return callback(err);
  });

  stream.on("data", function (chunk) {
    const buffPtr = buffToPtr(chunk);
    raw.crc64(crcPtr, buffPtr, chunk.length);
    binding._free(buffPtr);
  });
  stream.on("end", function () {
    if (errored) return;

    const ret = uint64PtrToStr(crcPtr);
    if (!crcPtrFreed) {
      binding._free(crcPtr);
      crcPtrFreed = true;
    }

    return callback(undefined, ret);
  });
};
module.exports.crc64Stream = function (stream, callback) {
  let errored = false;
  let crc = "0";
  stream.on("error", function (err) {
    errored = true;
    stream.destroy();
    return callback(err);
  });
  stream.on("data", function (chunk) {
    crc = module.exports.crc64(chunk, crc);
  });
  stream.on("end", function () {
    if (errored) return;
    return callback(undefined, crc);
  });
};

// 分片 crc64 合并：combined = shift(crc1, len2) ^ crc2
// crc1/crc2 均为以 0 初始态计算的寄存器值（数字字符串），len2 为第二段字节数
// 采用 GF(2) 矩阵快速幂，多项式方向与引擎一致（reflected: 0xC96C5795D7870F42）
const COMBINE_POLY = 0xc96c5795d7870f42n;

function gf2MatrixTimes(mat, vec) {
  let sum = 0n;
  for (let i = 0; i < 64; i++) {
    if ((vec >> BigInt(i)) & 1n) {
      sum ^= mat[i];
    }
  }
  return sum;
}

function gf2MatrixSquare(square, mat) {
  for (let i = 0; i < 64; i++) {
    square[i] = gf2MatrixTimes(mat, mat[i]);
  }
}

module.exports.combileCrc64 = function (str1, str2, len2, callback) {
  try {
    let crc1 = BigInt(str1);
    const crc2 = BigInt(str2);
    const len = Number(len2);
    if (!Number.isFinite(len) || len < 0) {
      throw new Error("Invalid combine length: " + len2);
    }
    if (len > 0) {
      // 单 bit 转移算子：S' = (S >> 1) ^ (LSB(S) ? POLY : 0)
      const odd = new Array(64);
      for (let i = 0; i < 64; i++) {
        odd[i] = i === 0 ? COMBINE_POLY : 1n << BigInt(i - 1);
      }
      const even = new Array(64);
      gf2MatrixSquare(even, odd);
      gf2MatrixSquare(odd, even);
      gf2MatrixSquare(even, odd);
      // even 现在是单字节（8 bit）转移算子，对其做 len2 次快速幂
      let n = len;
      let mat = even;
      while (n > 0) {
        if (n & 1) {
          crc1 = gf2MatrixTimes(mat, crc1);
        }
        n >>= 1;
        if (n === 0) break;
        const next = new Array(64);
        gf2MatrixSquare(next, mat);
        mat = next;
      }
      crc1 ^= crc2;
    }
    return callback(undefined, crc1.toString());
  } catch (err) {
    return callback(err);
  }
};
