angular.module('web').factory('Mailer', [
  'settingsSvs',
  function(settingsSvs) {
    // P4-02：nodemailer 升级至 6.x，nodemailer-smtp-transport 已废弃移除，
    // createTransport(smtp) 直传（对象结构等价于 smtpTransport(smtp) 包装结果）
    var nodemailer = require('nodemailer');

    return {
      send: function(info) {
        return new Promise((resolve, reject) => {
          var smtp = settingsSvs.mailSmtp.get();
          var opt = {
            from: smtp.from,
            to: info.to,
            subject: info.subject,
            html: info.html || info.content
          };
          // console.log('sending..', smtp, opt);

          var transporter = nodemailer.createTransport(smtp);

          transporter.sendMail(opt, function(err, info) {
            if (err) { reject(err); } else { resolve(info); }
          });
        });
      }
    };
  }
]);
