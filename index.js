var express = require('express')
var fetch = require('node-fetch')
var cheerio = require('cheerio')
var _ = require('underscore')
var sassMiddleware = require('node-sass-middleware')
var path = require('path')

var roomList = []

function fetchAll () {
  function merge (app, rooms) {
    roomList = _.reject(roomList, function (r) {
      return r.app === app
    }).concat(rooms)
  }

  // janus
  fetch('http://beta.vrsites.com/janus-server/').then(function (res) {
    return res.text()
  }).then(function (html) {
    var room = {
      name: 'Lobby',
      url: 'http://janusvr.com/',
      app: 'janusvr',
      occupants: parseInt(html.match(/Clients.+?<span>(\d+)/)[1], 10)
    }

    merge('janusvr', [room])
  })

  // altspace
  fetch('https://account.altvr.com/spaces').then(function (res) {
    return res.text()
  }).then(function (html) {
    var doc = cheerio.load(html)
    var rooms = []

    doc('.main-content .content-block').each(function (index, el) {
      var div = cheerio(el)
      var id = div.find('.visit-button a').attr('data-altspace-space-id')

      var room = {
        name: div.find('.block-sub-name').text().replace(/^[\n\s\r@]+/, '').replace(/\s\n[0-9\n]+/, ''),
        occupants: parseInt(div.find('.capacity-part').text(), 10),
        app: 'altspace',
        url: 'altspace://account.altvr.com/api/spaces/' + id
      }

      if (id) {
        rooms.push(room)
      }
    })

    merge('altspace', rooms)
  })

  // vrchat
  var body = '{"where":{"$or":[{"occupants":{"$gt":0},"client":"vrc5"},{"persistent":false,"client":"vrc5"}]},"limit":100,"order":"objectId","_method":"GET","_ApplicationId":"wHueeBjWpgboCEu7PqYbSDMpn3Cj6GCpLq29THf1","_JavaScriptKey":"vbLfFuzaZAIktPZePUhFexDDjkwwwEmC6XqQ5zag","_ClientVersion":"js1.4.0","_InstallationId":"db82f821-e091-6891-d216-663875dce8a7"}'

  fetch('https://api.parse.com/1/classes/RoomEntry', {
    method: 'POST',
    body: body
  }).then(function (res) {
    return res.json()
  }).then(function (response) {
    var rooms = response.results.map(function (r) {
      return {
        occupants: r.occupants,
        name: r.name,
        app: 'vrchat',
        url: 'http://vrchat.net/launch.php?id=' + r.room_id
      }
    })

    merge('vrchat', rooms)
  })

  // convrge
  fetch('http://convrge.co/api/users')
    .then(function (res) {
      return res.json()
    }).then(function (response) {
      var room = {
        occupants: Object.keys(response.playersOnline).length,
        name: 'Homeroom',
        app: 'convrge',
        url: 'http://www.convrge.co/'
      }

      merge('convrge', [room])
    })
}

var app = express()

app.set('view engine', 'ejs')

app.get('/', function (req, res) {
  var rooms = roomList.filter(function (r) {
    return r.occupants > 0
  })

  rooms = _.sortBy(rooms, 'occupancy')

  res.render('index', { rooms: rooms })
})

app.use(sassMiddleware({
  src: path.join(__dirname, 'stylesheets'),
  dest: path.join(__dirname, 'public'),
  debug: true
}))
app.use(express.static(path.join(__dirname, 'public')))

setInterval(function () {
  fetchAll()
}, 30 * 1000)

fetchAll()

var server = app.listen((process.env.PORT || 5000), function () {
  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)
})
