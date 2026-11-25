// 等价 autoUpgradeSvs.compareVersion：纯函数，语义冻结。
export function compareVersion(curV, lastV) {
  const arr = String(curV).split('.');
  const arr2 = String(lastV).split('.');

  const len = Math.max(arr.length, arr2.length);

  for (let i = 0; i < len; i++) {
    const a = parseInt(arr[i]);
    const b = parseInt(arr2[i]);

    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
  }

  return 0;
}