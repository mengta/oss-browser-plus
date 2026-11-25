// 等价 Angular Const（app/const.js）中 B2 范围使用的数据片段。
// 数据冻结：countryNum 22 项与 REG.EMAIL 正则逐字符一致。

export const countryNum = [
  { label: '中国大陆(+86)', value: '86' },
  { label: '香港(+852)', value: '852' },
  { label: '澳门(+853)', value: '853' },
  { label: '台湾(+886)', value: '886' },
  { label: '韩国(+82)', value: '82' },
  { label: '日本(+81)', value: '81' },
  { label: '美国(+1)', value: '1' },
  { label: '加拿大(+1)', value: '1' },
  { label: '英国(+44)', value: '44' },
  { label: '澳大利亚(+61)', value: '61' },
  { label: '新加坡(+65)', value: '65' },
  { label: '马来西亚(+60)', value: '60' },
  { label: '泰国(+66)', value: '66' },
  { label: '越南(+84)', value: '84' },
  { label: '菲律宾(+63)', value: '63' },
  { label: '印度尼西亚(+62)', value: '62' },
  { label: '德国(+49)', value: '49' },
  { label: '意大利(+39)', value: '39' },
  { label: '法国(+33)', value: '33' },
  { label: '俄罗斯(+7)', value: '7' },
  { label: '新西兰(+64)', value: '64' },
  { label: '荷兰(+31)', value: '31' },
  { label: '瑞典(+46)', value: '46' },
  { label: '乌克兰(+380)', value: '380' },
];

export const REG = {
  EMAIL: /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z0-9]{2,6}$/,
  USERNAME: /^[a-zA-Z0-9.@\-_]+$/,
};