// 等价 Angular list-filter（app/components/filters/list-filter.js）：
// 子串匹配（非前缀）、大小写敏感、value 为空返回原数组、数组为空返回 []。

export function listFilter(arr, keyFn, value) {
  if (!value) {
    return arr;
  }
  if (arr && arr.length > 0) {
    const result = [];
    if (typeof keyFn === 'string') {
      for (const item of arr) {
        if (String(item[keyFn]).indexOf(value) !== -1) {
          result.push(item);
        }
      }
    } else if (typeof keyFn === 'function') {
      for (const item of arr) {
        if (String(keyFn(item)).indexOf(value) !== -1) {
          result.push(item);
        }
      }
    }
    return result;
  }
  return [];
}

export const filterList = listFilter;