var smsapipl = require('smsapi-pl');
var schedule = require('node-schedule');
var syncRequest = require('sync-request');
var cheerio = require('cheerio');

var smsPhoneNumber = process.env.SMS_PHONE_NUMBER;
var smsUsername = process.env.SMS_USERNAME;
var smsPassword = process.env.SMS_PASSWORD;
var docplannerUrl = process.env.DOCPLANNER_URL;

function sendSms(message, number) {
  var sender = new smsapipl.API({
    username: smsUsername,
    password: smsPassword
  });

  var msg = new smsapipl.Message({
    to: number,
    message: message,
    encoding: "utf-8",
  });

  sender.send(msg, function (err, cb) {
    if (err) {
      console.log(err.message);
    } else {
      console.log(cb);
    }
  });
}

function failure () {
  var message = "Failed to check doctor's calendar";
  console.log(message);
  sendSms(message, smsPhoneNumber);
}

if (!smsPhoneNumber || !smsUsername || !smsPassword || !docplannerUrl) {
  console.log("Environmental variables are missing.");
  return failure();
}

var job = schedule.scheduleJob('* * * * *', function() {
  var html = syncRequest('GET', docplannerUrl);

  // check if we got HTML
  if (!html || html.statusCode !== 200) { return failure(); }

  // try to get doc ID
  var $  = cheerio.load(html.getBody());
  var doctorId = $('.calendars-carousel').data('calendar-id');
  if (!doctorId) { return failure(); }

  console.log("--- " + new Date() + " ---");

  var occupied = 0;
  var free = 0;

  // get calendar of given doctor
  for (var i = 0; i < 10; i++) {
    html = syncRequest('GET', 'https://www.znanylekarz.pl/calendar-main/' + doctorId + '/week/' + i + '/1?showUserVisits=1');
    if (!html || html.statusCode !== 200) { return failure(); }
    $  = cheerio.load(html.getBody());

    if (!$('.calendar').length) { return failure(); }
    occupied += $('.calendar tr td s').length;
    free += $('.calendar tr td a.visit').length;
  }

  if (occupied || free) {
    var message = "Doctor has " + occupied + " occucpied and " + free + " free slots.";
    console.log(message);
    sendSms(message, smsPhoneNumber);
  } else {
    console.log("Doctor doesn't have any slots in the calendar.");
  }
});
