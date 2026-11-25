export const AUTH_INFO_KEY = 'auth-info';
export const AUTH_HIS = 'auth-his';
export const AUTH_KEEP = 'auth-keep';
export const KEY_REMEMBER = 'auth-remember';
export const KEY_AUTHTOKEN = 'key-authtoken';
export const MAIL_SENDER = 'mailSender';
export const PRIVATE_LINK = 'private-link';
export const KEEP_ME_LOGGED_IN = 'keep-me-logged-in';
export const SHOW_HIS = 'show-his';
export const SHOW_REQUEST_PAY = 'show-request-pay';
export const SHOW_SECURE = 'show-secure';

export const REG = {
  EMAIL: /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z0-9]{2,6}$/,
};

export const bucketACL = [
  { acl: 'private', label: '私有' },
  { acl: 'public-read', label: '公共读' },
  { acl: 'public-read-write', label: '公共读写' },
];

export function getStorageClasses(flag) {
  const base = [
    { value: 'Standard', name: '标准类型' },
    { value: 'IA', name: '低频访问类型' },
  ];
  if (flag === 3) {
    return base.concat([{ value: 'Archive', name: '归档类型' }]);
  }
  if (flag === 2) {
    return base;
  }
  return [{ value: 'Standard', name: '标准类型' }];
}

const REGION_LIST = [
  ['oss-cn-hangzhou', '华东1(杭州)'],
  ['oss-cn-shanghai', '华东2(上海)'],
  ['oss-cn-nanjing', '华东5(南京本地地域)'],
  ['oss-cn-fuzhou', '华东6(福州本地地域)'],
  ['oss-cn-qingdao', '华北1(青岛)'],
  ['oss-cn-beijing', '华北2(北京)'],
  ['oss-cn-zhangjiakou', '华北3(张家口)'],
  ['oss-cn-huhehaote', '华北5(呼和浩特)'],
  ['oss-cn-wulanchabu', '华北6(乌兰察布)'],
  ['oss-cn-shenzhen', '华南1(深圳)'],
  ['oss-cn-heyuan', '华南2(河源)'],
  ['oss-cn-guangzhou', '华南3（广州）'],
  ['oss-cn-chengdu', '西南1(成都)'],
  ['oss-cn-hongkong', '中国(香港)'],
  ['oss-us-west-1', '美国西部1(硅谷)'],
  ['oss-us-east-1', '美国东部1(弗吉尼亚)'],
  ['oss-ap-northeast-1', '日本(东京)'],
  ['oss-ap-northeast-2', '韩国(首尔)'],
  ['oss-ap-southeast-1', '亚太东南1(新加坡)'],
  ['oss-ap-southeast-2', '亚太东南2(悉尼)'],
  ['oss-ap-southeast-3', '亚太东南3(吉隆坡)'],
  ['oss-ap-southeast-5', '亚太东南5(雅加达)'],
  ['oss-ap-southeast-6', '菲律宾(马尼拉)'],
  ['oss-ap-southeast-7', '泰国(曼谷)'],
  ['oss-ap-south-1', '印度(孟买)'],
  ['oss-eu-central-1', '德国(法兰克福)'],
  ['oss-eu-west-1', '英国(伦敦)'],
  ['oss-me-east-1', '阿联酋(迪拜)'],
];

export const regions = REGION_LIST.map(([id, label]) => ({
  id,
  label,
  storageClasses: getStorageClasses(3),
}));