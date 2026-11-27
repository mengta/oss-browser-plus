'use strict';
// 来源：oss2.js:95-2077（P6c 拆分）

// P6c（T-P6c-01 纯移动 + T-P6c-03 去 Angular）：由 services/oss2.js 拆分。
// eslint-disable-next-line no-unused-vars
const { $state, Toast, ALY, AliOSS, USER_AGENT, log, state, rootScope, currentAuth, currentCtx, connectTimeout } = require('./context');
    function getClient2(opt) {
      // P6c/P7b：禁止浏览器 UMD bundle（ali-oss/dist/aliyun-oss-sdk 在 Node 引用 window），统一走 ali-oss 主入口
      return getClient3(opt);
    }


    function getClient3(opt) {
      const options = prepaireOptions(opt);

      const final = {
        accessKeyId: options.accessKeyId,
        accessKeySecret: options.secretAccessKey,
        bucket: opt.bucket,
        endpoint: options.endpoint,
        region: opt.region,
        timeout: options.httpOptions.timeout,
        cname: options.cname,
        isRequestPay: options.isRequestPayer,
        sldEnable: options.sldEnable
      };

      if (Object.prototype.hasOwnProperty.call(options, 'securityToken')) {
        final.stsToken = options.securityToken;
      }

      const client = new AliOSS(final);

      client.userAgent = USER_AGENT;

      return client;
    }


    function getClient(opt) {
      var options = prepaireOptions(opt);

      ALY.util.xUserAgent = () => USER_AGENT;
      var client = new ALY.OSS(options);

      return client;
    }


    function prepaireOptions(opt) {
      var authInfo = currentAuth();
      const privateLink = currentCtx().privateLink || '';
      const isPrivateLink = privateLink !== '';
      var bucket;

      if (opt) {
        if (typeof opt === 'object') {
          Object.assign(authInfo, opt);
          bucket = opt.bucket;
        }
      }

      var endpointname = authInfo.cname ? authInfo.eptplcname : authInfo.eptpl;
      var endpoint = isPrivateLink ? privateLink : getOssEndpoint(
          authInfo.region || 'oss-cn-beijing',
          bucket,
          endpointname
      );

      log.debug('[endpoint]:', endpoint);
      const timeout = connectTimeout();
      const options = {
        // region: authInfo.region,
        accessKeyId: authInfo.id || 'a',
        secretAccessKey: authInfo.secret || 'a',
        endpoint: endpoint,
        apiVersion: '2013-10-15',
        httpOptions: {
          timeout: authInfo.httpOptions ? authInfo.httpOptions.timeout : timeout
        },
        maxRetries: 50,
        cname: isPrivateLink ? false : authInfo.cname || false,
        isRequestPayer: authInfo.requestpaystatus != 'NO',
        sldEnable: isPrivateLink
      };

      if (authInfo.id && authInfo.id.indexOf('STS.') == 0) {
        options.securityToken = authInfo.stoken || null;
      }

      return options;
    }


    function parseOSSPath(ossPath) {
      if (!ossPath || ossPath.indexOf(state.DEF_ADDR) == -1 || ossPath == state.DEF_ADDR) {
        return {};
      }

      var str = ossPath.substring(state.DEF_ADDR.length);
      var ind = str.indexOf('/');
      let bucket;
      let key;

      if (ind == -1) {
        bucket = str;
        key = '';
      } else {
        bucket = str.substring(0, ind);
        key = str.substring(ind + 1);
      }

      return {
        bucket: bucket,
        key: key
      };
    }
     

    function getOssUrl(region, bucket, key) {
      var eptpl = currentAuth().eptpl || 'http://{region}.aliyuncs.com';

      var protocol = eptpl.indexOf('https:') == 0 ? 'https:' : 'http:'; // Global.ossEndpointProtocol == 'https:';

      if (bucket && rootScope().bucketMap && rootScope().bucketMap[bucket]) {
        var endpoint =
          rootScope().bucketMap[bucket][
              rootScope().internalSupported
                ? 'intranetEndpoint'
                : 'extranetEndpoint'
          ];

        if (endpoint) {
          // return 'http://'+ endpoint + '/' + key;
          return protocol + '//' + bucket + '.' + endpoint + '/' + key;
          // return isHttps ? (protocol+'//'+ bucket+'.'+ endpoint  +'/' + key) : ('http://'+ endpoint + '/' + key);
        }
      }

      // region是domain
      if (region) {
        if (region.indexOf('.') != -1) {
          if (region.indexOf('http') == -1) {
            region = protocol + '//' + bucket + '.' + region + '/' + key;
          }

          return region;
        }

        return (
          protocol + '//' + bucket + '.' + region + '.aliyuncs.com/' + key
        );
      }

      let domain;

      if (eptpl.indexOf('https://') == 0) {
        domain = eptpl.substring(8, eptpl.length);
        domain.replace(/\/$/, '');

        return protocol + '//' + bucket + '.' + domain + '/' + key;
      }

      if (eptpl.indexOf('http://') == 0) {
        domain = eptpl.substring(7, eptpl.length);
        domain.replace(/\/$/, '');

        return protocol + '//' + bucket + '.' + domain + '/' + key;
      }

      return (
        protocol + '//' + bucket + '.' + region + '.aliyuncs.com/' + key
      );
    }


    function getOssEndpoint(region, bucket, eptpl) {
      eptpl = eptpl || currentAuth().eptpl || 'http://{region}.aliyuncs.com';

      // 通过bucket获取endpoint
      if (bucket && rootScope().bucketMap && rootScope().bucketMap[bucket]) {
        var endpoint =
          rootScope().bucketMap[bucket][
              rootScope().internalSupported
                ? 'intranetEndpoint'
                : 'extranetEndpoint'
          ];

        if (endpoint) {
          return eptpl.indexOf('https://') == 0
            ? 'https://' + endpoint
            : 'http://' + endpoint;
        }
      }

      eptpl = eptpl.replace('{region}', region);

      return eptpl;

      //
      // //region是domain
      // if (region && region.indexOf('.') != -1) {
      //   if (region.indexOf('http') != 0) {
      //     region = Global.ossEndpointProtocol == 'https:' ? ('https://' + region + ':443') : ('http://' + region);
      //   }
      //   return region;
      // }
      //
      // //region
      // if (Global.ossEndpointProtocol == 'https:') {
      //   return rootScope().internalSupported
      //       ?'https://' + region + '-internal.aliyuncs.com:443'
      //       :'https://' + region + '.aliyuncs.com:443';
      // }
      // return rootScope().internalSupported
      //       ? 'http://' + region + '-internal.aliyuncs.com'
      //       : 'http://' + region + '.aliyuncs.com';
    }


    function signatureUrl(region, bucket, key, expiresSec) {
      // ali-oss（Node）签名，避免 aliyun-sdk 浏览器分支差异
      return getClient3({
        region: region,
        bucket: bucket
      }).signatureUrl(key, { expires: expiresSec || 60 });
    }


    function signatureUrl2(region, bucket, key, expires, xprocess) {
      var client = getClient2({
        region: region,
        bucket: bucket
      });

      return client.signatureUrl(key, {
        expires: expires,
        process: xprocess
      });
    }


    function checkFileExists(region, bucket, key) {
      return new Promise(function(a, b) {
        var client = getClient({
          region: region,
          bucket: bucket
        });
        var opt = {
          Bucket: bucket,
          Key: key
        };

        client.headObject(opt, function(err, data) {
          if (err) {
            b(err);
          } else {
            a(data);
          }
        });
      });
    }


    function checkFolderExists(region, bucket, prefix) {
      const client = getClient3({
        region: region,
        bucket: bucket
      });

      return client
          .listV2({
            prefix: prefix,
            'max-keys': 1
          })
          .then((res) => {
            if (res.keyCount != 0) {
              return true;
            }

            return false;
          });
    }


    function handleError(err) {
      if (err.code == 'InvalidAccessKeyId') {
        log.warn('InvalidAccessKeyId: 回登录');
      } else {
        if (!err.code) {
          if (err.message.indexOf('Failed to fetch') != -1) {
            err = {
              code: 'Error',
              message: '无法连接'
            };
          } else {
            err = {
              code: 'Error',
              message: err.message
            };
          }
        }

        if (
          err.code == 'NetworkingError' &&
          err.message.indexOf('ENOTFOUND') != -1
        ) {
          log.error(err);
        } else { log.warn(err.code + ': ' + err.message); }
      }

      return Promise.reject(err);
    }

    /**
     * @param opt   {object|string}
     *    object = {id, secret, region, bucket}
     */

module.exports = {
  getClient2, getClient3, getClient, prepaireOptions, parseOSSPath, getOssUrl, getOssEndpoint, signatureUrl, signatureUrl2, checkFileExists, checkFolderExists, handleError,
  USER_AGENT
};
