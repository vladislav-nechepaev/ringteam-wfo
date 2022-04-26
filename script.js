const http = require("http")
const https = require("https")
const { Pool, Client } = require('pg')
const pgformat = require('pg-format')
const base64 = require("base-64")
const fs = require("fs")
const request = require("request-promise")
const xmljs = require("xml-js")
const schedule = require("node-schedule")
const express = require("express")
const cors = require("cors")
const settings = require('./settings.json')
const pgActions = require('./pg_actions.js')
const jssha = require('jssha')

const app = express()
app.use(express.static('public'))

var whitelist = ['https://ringteam.freshservice.com', 'https://ringteam-fs-test.freshservice.com']
var corsOptions = {
  origin: function (origin, callback) {
    console.log(origin)
    if (whitelist.includes(origin) || !origin) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

// ============================================================================
// ============================================================================
// ============================================================================

app.post('/v2/addcapacity', (req, res) => { handleCapacityV3(req, res, "inc") })

app.post('/v2/removecapacity', (req, res) => { handleCapacityV3(req, res, "dec") })

app.get('/v2/getcapacity', cors(corsOptions), (req, res) => { collectCapacityV3(req, res) })

app.get('/v4/getcapacity', cors(corsOptions), (req, res) => { collectCapacityV4(req, res) })

app.get('/getinventory', cors(corsOptions), (req, res) => { handleInventory(req, res) })

app.post('/updateinventory', (req, res) => { updateInventory(req, res) })

app.post('/replaceinventory', cors(corsOptions), (req, res) => { replaceInventory(req, res) })

app.post('/addparking', (req, res) => { handleParking(req, res, "inc") })

app.post('/removeparking', (req, res) => { handleParking(req, res, "dec") })

app.post('/v2/addparking', (req, res) => { handleParkingV2(req, res, "inc") })

app.post('/v2/removeparking', (req, res) => { handleParkingV2(req, res, "dec") })

app.get('/getparking', cors(corsOptions), (req, res) => { getParking(req, res) })

app.get('/getparkingbulk', cors(corsOptions), (req, res) => { getParkingBulk(req, res) })

app.get('/getparkingidentry', cors(corsOptions), (req, res) => { getParkingIDEntry(req, res) })

app.post('/updateparkingidentry', cors(corsOptions), (req, res) => { updateParkingIDEntry(req, res) })

app.post('/replaceparkingiddata', cors(corsOptions), (req, res) => { replaceParkingIDData(req, res) })

app.get('/getbamboodata', cors(corsOptions), (req, res) => { getBambooData(req, res) })

app.get('/getmeidologin', cors(corsOptions), (req,res) => { getMeidoLogin(req, res) })

app.get('/getuserdata', cors(corsOptions), (req,res) => { getUserData(req, res) })

app.get('/getmeidolocations', (req, res) => { getMeidoLocations(req, res) })

app.get('/getholidays', cors(corsOptions), (req, res) => { getHolidays(req, res) })

app.get('/getmeidotime', cors(corsOptions), (req, res) => { getMeidoTime(req, res) })

app.get('/getmeidotimetest', cors(corsOptions), (req, res) => { getMeidoTimeTest(req, res) })

app.post('/avigilon/add', (req, res) => { handleAvigilon(req, res, "add") })

app.post('/avigilon/remove', (req, res) => { handleAvigilon(req, res, "remove") })

app.get('/avigilon/get', cors(corsOptions), (req, res) => { getAvigilon(req, res) })

app.put('/avigilon/modify', cors(corsOptions), (req, res) => { modifyAvigilon(req, res) })

app.get('/dev/avigilon/get', cors(corsOptions), (req, res) => { getAvigilonDev(req, res) })

app.get('/netsuite/teambuilding/participants', cors(corsOptions), (req, res) => { netsuiteGetTeambuildingParticipants(req, res) })

app.post('/officespace/create', (req, res) => { officeSpaceParkingCreate(req, res) })

app.post('/officespace/cancel', (req, res) => { officeSpaceParkingCancel(req, res) })

app.get('/parkinglist/lviv', cors(corsOptions), (req, res) => { parkingTableLviv(req, res) })

// ============================================================================
// ============================================================================
// ============================================================================

class Avigilon {
  constructor(settings){
    this.host = `https://${settings.login}:${settings.pass}@${settings.domain}/`
  }

  get(method){
    console.log(this.host + method)
    return request(this.host + method, {
      headers: {
        "Content-Type": "application/xml"
      },
      insecure: true,
      rejectUnauthorized: false
    }).then(res => {
      return JSON.parse(xmljs.xml2json(res, { compact: true }))
    }).catch(err => {
      console.error(err)
    })
  }

  put(method, data){
    //console.log(this.host + method)
    return request.put(this.host + method, {
      headers: {
        "Content-Type": "application/xml"
      },
      insecure: true,
      rejectUnauthorized: false,
      body: data
    }).then(res => {
      return JSON.parse(xmljs.xml2json(res, { compact: true }))
    }).catch(err => {
      console.error(err)
    })
  }

  post(method, data){
    //console.log(this.host + method)
    return request.post(this.host + method, {
      headers: {
        "Content-Type": "application/xml"
      },
      insecure: true,
      rejectUnauthorized: false,
      body: data
    }).then(res => {
      return JSON.parse(xmljs.xml2json(res, { compact: true }))
    }).catch(err => {
      console.error(err)
    })
  }

  getIdentityList(){
    return this.get(`identities.xml?filter=plasecidentityEmailaddress=*`).then(res => {
      return res.identities
    })
  }

  getIdentityCN(email){
    return this.get(`identities.xml?filter=plasecidentityEmailaddress=${email}`).then(res => {
      return res.identities.identity.cns.cn._text
    })
  }

  getToken(cn){
    return this.get(`identities/${cn}/tokens.xml`).then(res => {
      return res.tokens.token
    })
  }

  updateToken(userCN, tokenCN, tokenType, dates, active = false){
    const data = {
      token: {
        plasecTokenstatus: {
          _text: active ? '1' : '2'
        },
        plasecTokenType: {
          _text: tokenType
        }
      }
    }
    const dataXML = xmljs.js2xml(data, { compact: true })
    return this.put(`identities/${userCN}/tokens/${tokenCN}.xml?plasecIssuedate=${dates.issueDate}&plasecActivatedate=${dates.activateDate}&plasecDeactivatedate=${dates.deactivateDate}`, dataXML)
  }

  updateTokenSimple(userCN, tokenCN, active = false){
    const data = {
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "utf-8"
        }
      },
      token: {
        plasecTokenstatus: {
          _text: active ? '1' : '2'
        }
      }
    }
    const dataXML = xmljs.js2xml(data, { compact: true })
    return this.put(`identities/${userCN}/tokens/${tokenCN}.xml`, dataXML)
  }

  createToken(userCN, data){
    const dataToXML = {
      plasecInternalNumber: {
        _text: data.internalNumber
      }
    }
    const dataXML = xmljs.js2xml(dataToXML, { compact: true })
    return this.post(`identities/${userCN}/tokens.xml?plasecIssuedate=${data.issueDate}&plasecActivatedate=${data.activateDate}&plasecDeactivatedate=${data.deactivateDate}`, dataXML)
  }

  parseAvigilonDateToURL(string){
    return `${string.substring(4,6)}/${string.substring(6,8)}/${string.substring(0,4)}`
  }
}
class OfficeSpace {
  constructor(settings){
    this.domain = `https://${settings.domain}/api/1/`
    this.headers = {
      "Authorization": `Token token=${settings.api_key}`
    }
    this.parkingFloorId = settings.parking_floor_id
  }

  get(method){
    return request(this.domain + method, {
      headers: this.headers
    }).then(res => {
      return JSON.parse(res)
    }).catch(err => {
      console.error(err)
    })
  }

  put(method, data){
    return request.put(this.domain + method, {
      headers: this.headers,
      body: JSON.stringify(data)
    }).then(res => {
      return res ? JSON.parse(res) : ""
    }).catch(err => {
      console.error(err)
    })
  }

  post(method, data){
    return request.post(this.domain + method, {
      headers: this.headers,
      body: JSON.stringify(data)
    }).then(res => {
      return res ? JSON.parse(res) : ""
    }).catch(err => {
      console.error(err)
    })
  }

  delete(method){
    return request(this.domain + method, {
      headers: this.headers
    }).then(res => {
      return res ? JSON.parse(res) : ""
    }).catch(err => {
      console.error(err)
    })
  }

  getParkingFloorSeats(){
    return this.get(`seats?floor_id=${this.parkingFloorId}`)
  }
}

const pool = new Pool(settings.psql)
const avigilon = new Avigilon(settings.avigilon)

app.listen(5000, "127.0.0.1", function(){
  console.log("========== RUNNING ==========")
  prepareTable()
})

const job = schedule.scheduleJob("0 2 * * *", (fireDate) => {
  console.log(`Schedule ran at ${fireDate}`)
  avigilonDaily()
})

// ============================================================================
// ============================================================================
// ============================================================================

async function prepareTable(){
  const client = await pool.connect()
  try {
    await client.query(pgActions.createIncrementFunction)
    await client.query(pgActions.createDecrementFunction)
    await client.query(pgActions.createParkingIDStorageTable)
    console.log('Init complete')
  } catch (e) {
    console.error("Failed to init!")
    console.error(e)
  } finally {
    client.release()
  }
}

async function netsuiteGetTeambuildingParticipants(req, res){
  if (!req.query.emails) {
    res.writeHead(400, "Not enough data")
    res.end('Not enough data')
  } else {
    const url = "https://5138697-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1307&deploy=1" + "&consultants=" + encodeURIComponent(req.query.emails)
    const headers = prepareHeaders(url)
    try {
      const response = await request.get(url, { headers: headers, followRedirect: true })
      res.writeHead(200)
      res.end(response)
    } catch(err) {
      res.writeHead(500)
      res.end(err.response.body)
    }
  }

  // ==============================

  function prepareHeaders(url){
    const timestamp = Math.floor(new Date().valueOf() / 1000)
    const nonce = generateNonce()
    const signature = prepareOAuthSignature(timestamp, nonce, settings.netsuite, url)
    const authHeader = `OAuth realm="${settings.netsuite.realm}",oauth_consumer_key="${settings.netsuite.consumerKey}",oauth_token="${settings.netsuite.token}",oauth_signature_method="HMAC-SHA256",oauth_timestamp="${timestamp}",oauth_nonce="${nonce}",oauth_version="1.0",oauth_signature="${encodeURIComponent(signature)}"`
    const headers = {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "Cookie": "NS_ROUTING_VERSION=LAGGING"
    }
    return headers
  }

  function prepareOAuthSignature(timestamp, nonce, iparams, url){
    const hmacKey = `${settings.netsuite.consumerSecret}&${settings.netsuite.tokenSecret}`
    const shaObj = new jssha("SHA-256", "TEXT", {
      hmacKey: { value: hmacKey, format: "TEXT" }
    })
    const urlParts = url.split("?")
    const urlParams = urlParts[1].split("&")
    var params = [
      `oauth_consumer_key=${settings.netsuite.consumerKey}`,
      `oauth_token=${settings.netsuite.token}`,
      `oauth_signature_method=HMAC-SHA256`,
      `oauth_nonce=${nonce}`,
      `oauth_timestamp=${timestamp}`,
      `oauth_version=1.0`
    ]
    params = params.concat(urlParams)
    params.sort()
    const baseString = `GET&${encodeURIComponent(urlParts[0])}&${encodeURIComponent(params.join("&"))}`
    shaObj.update(baseString)
    const signature = shaObj.getHash("B64")
    return signature
  }

  function generateNonce(){
    var result = ''
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    var charactersLength = characters.length
    for ( var i = 0; i < 10; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
   return result
  }
}

function modifyAvigilon(req, res){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(401, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    const body = JSON.parse(data)
    const client = await pool.connect()
    try {
      for (let date in body.dates) {
        const dbData = await client.query(`SELECT * FROM avigilon WHERE date = $1`, [date])
        const emailList = dbData.rows[0].emails
        if (emailList.includes(body.email)) {
          if (!body.dates[date]) await client.query(`UPDATE avigilon SET emails = array_remove(emails, $1) WHERE date = $2;`, [body.email, date])
        } else {
          if (body.dates[date]) await client.query(`UPDATE avigilon SET emails = array_append(avigilon.emails, $1) WHERE date = $2;`, [body.email, date])
        }
        //client.query(`UPDATE avigilon SET emails = array_remove(emails, $1) WHERE date = $2;`, [body.email, date])
      }
      res.writeHead(202, "Success!")
      res.end()
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error!")
      res.end()
    } finally {
      client.release()
    }
  })
}

function officeSpaceParkingCreate(req, res){
  // CURRENTLY CONFIGURED FOR REGULAR PARKING ONLY
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    console.log(data)
    const body = JSON.parse(data)
    res.writeHead(200)
    res.end()
    const parkingAlias = settings.parking_officespace[body.floor]
    if (parkingAlias) {
      const today = new Date().toISOString().split("T")[0]
      const parkingPlatformaAliases = [
        "parking_platforma",
        "parking_platforma_test"
      ]
      const client = await pool.connect()
      if (parkingPlatformaAliases.includes(parkingAlias)) {
        // =====================================================
        console.log("OfficeSpace v2 parking: Not supported yet!")
        // =====================================================
      } else {
        await client.query(`INSERT INTO ${parkingAlias}(id_list, date) VALUES (array[$1], $2) ON CONFLICT (date) DO UPDATE SET id_list = array_append(${parkingAlias}.id_list, $1);`, [body.email, today])
      }
      client.release()
    }
  })
}

function officeSpaceParkingCancel(req, res){
  // CURRENTLY CONFIGURED FOR REGULAR PARKING ONLY
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    console.log(data)
    const body = JSON.parse(data)
    res.writeHead(200)
    res.end()
    const parkingAlias = settings.parking_officespace[body.floor]
    if (parkingAlias) {
      const today = new Date().toISOString().split("T")[0]
      const parkingPlatformaAliases = [
        "parking_platforma",
        "parking_platforma_test"
      ]
      const client = await pool.connect()
      if (parkingPlatformaAliases.includes(parkingAlias)) {
        // =====================================================
        console.log("OfficeSpace v2 parking: Not supported yet!")
        // =====================================================
      } else {
        await client.query(`UPDATE ${parkingAlias} SET id_list = array_remove(id_list, $1) WHERE date = $2;`, [body.email, today])
      }
      client.release()
    }
  })
}

async function parkingTableLviv(req, res){
  const today = new Date().toISOString().split("T")[0]
  const client = await pool.connect()
  try {
    var htmlContent
    const dbData = await client.query("SELECT * FROM parking_lviv_test WHERE date = $1", [today])
    if (dbData.rows.length) {
      const userList = dbData.rows[0].id_list
      //                                                    vvv CHANGE vvv
      const parkingInfo = await client.query("SELECT * FROM parking_id_storage WHERE email = ANY ($1)", [userList])
      var tableContent = "<tr style='border:1px solid black'><th>Email</th><th>Car Number</th></tr>"
      for (let user of userList) {
        const details = parkingInfo.rows.find(x => x.email === user)
        //                                                         vvv CHANGE vvv
        tableContent += `<tr style="border:1px solid black"><td>${user}</td><td>${details ? details.car_number : "Not found"}</td><tr>`
      }
      htmlContent = `<table style="border:1px solid black">${tableContent}</table>`
    } else {
      htmlContent = "No parking slots were booked for today (as of yet)"
    }
    htmlContent = `<himl><head><title>Lviv Parking List</title></head></body>${htmlContent}</body></html>`
    res.set('Content-Type', 'text/html')
    res.writeHead(200)
    res.end(htmlContent)
  } catch(err) {
    console.error("Error in parkingTableLviv:")
    console.error(err)
  } finally {
    client.release()
  }
}

async function getAvigilon(req, res){
  //console.log('getAvigilon hit')
  //console.log(req.headers, settings.access_token)
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(401, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  if (!req.query.email || !req.query.dates) {
    res.writeHead(400)
    res.end('Not enough data')
  }
  const client = await pool.connect()
  try {
    const dates = JSON.parse(req.query.dates)
    const datesString = dates.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).map(x => `date = '${x}'`).join(" OR ")
    var data = await client.query(`SELECT * FROM avigilon WHERE ${datesString};`)
    //console.log(data.rows)
    const response = {}
    data.rows.forEach(row => {
      const date = row.date.toISOString().split("T")[0]
      response[date] = row.emails.includes(req.query.email)
    })
    res.writeHead(200)
    res.end(JSON.stringify(response))
  } catch(e) {
    console.log(e)
    res.writeHead(500, "Error!")
    res.end()
  } finally {
    client.release()
  }
}

async function getAvigilonDev(req, res){
  console.log('dev avigilon hit')
  if (!req.query.email) {
    res.writeHead(400, "Not enough data")
    res.end('Not enough data')
  }
  try{
    console.log("getting identity cn")
    const identityCN = await avigilon.getIdentityCN(req.query.email)
    console.log(identityCN)
    const token = await avigilon.getToken(identityCN)
    res.writeHead(200)
    res.end(JSON.stringify(token))
  } catch(err) {
    console.error("AVIGILON")
    console.error(err)
    res.writeHead(400)
    res.end()
  }
}

function handleAvigilon(req, res, type){
  //console.log('hit')
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(401, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    const body = JSON.parse(data)
    if (!body.email) {
      res.writeHead(400, 'Not enough data')
      res.end('Not enough data')
      throw 'Payload error'
    }
    const client = await pool.connect()
    const today = new Date().toISOString().split("T")[0]
    var urgentUpdateNeeded = false
    try {
      for (let date of body.dates) {
        //console.log(date, today, date === today)
        if (date === today) urgentUpdateNeeded = true
        if (type === "add") await client.query(`INSERT INTO avigilon(emails, date) VALUES (array[$1], $2) ON CONFLICT (date) DO UPDATE SET emails = array_append(avigilon.emails, $1);`, [body.email, date])
        if (type === "remove") await client.query(`UPDATE avigilon SET emails = array_remove(emails, $1) WHERE date = $2;`, [body.email, date])
      }
      res.writeHead(200, "Success!")
      res.end()
      if (urgentUpdateNeeded) {
        var result = false
        var count = 0
        do {
          result = await urgentUpdate(body.email, type)
        } while (!result && ++count < 5)
      }
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error!")
      res.end()
    } finally {
      client.release()
    }
  })

  function urgentUpdate(email, type){
    //console.log('hit!!!')
    //const avigilon = new Avigilon(settings.avigilon)
    try {
      var userCN
      return avigilon.getIdentityCN(email).then(identity => {
        userCN = identity
        return avigilon.getToken(userCN)
      }).then(token => {
        const tokenCN = token.cns.cn._text
        return avigilon.updateTokenSimple(userCN, tokenCN, type === "add")
      }).then(res => {
        return true
      })
    } catch(e) {
      console.error(`[AVIGILON]: Error on ${email} - ` + e)
      return false
    }
  }
}

function urgentAvigilonUpdate(email, type){
  //console.log('hit!!!')
  //const avigilon = new Avigilon(settings.avigilon)
  try {
    var userCN
    return avigilon.getIdentityCN(email).then(identity => {
      userCN = identity
      return avigilon.getToken(userCN)
    }).then(token => {
      const tokenCN = token.cns.cn._text
      return avigilon.updateTokenSimple(userCN, tokenCN, type === "add")
    }).then(res => {
      return true
    })
  } catch(e) {
    console.error(`[AVIGILON]: Error on ${email} - ` + e)
    return false
  }
}

function getMeidoTime(req, res){
  const time = new Date()
  request("https://www.timeapi.io/api/Time/current/zone?timeZone=Europe/Kiev").then(responseRaw => {
    const response = JSON.parse(responseRaw)
    const weekday = new Date(response.dateTime).getDay()
    //console.log(response.hour, response.minute, weekday)
    const isAllowed = !(weekday === 6 || weekday === 0 || (weekday === 5 && ((response.hour >= 19 && response.minute >= 30)) || (response.hour >= 20)))
    res.writeHead(200)
    res.end(JSON.stringify(isAllowed))
  })
}

function getMeidoTimeTest(req, res){
  const time = new Date()
  request("https://www.timeapi.io/api/Time/current/zone?timeZone=Europe/Kiev").then(responseRaw => {
    const response = JSON.parse(responseRaw)
    const weekday = new Date(response.dateTime).getDay()
    console.log(response.hour, response.minute, weekday)
    const isAllowed = !(weekday === 6 || weekday === 0 || (weekday === 5 && ((response.hour >= 19 && response.minute >= 30)) || (response.hour >= 20)))
    res.writeHead(200)
    res.end(JSON.stringify(isAllowed))
  })
}

function getHolidays(req, res){
  const todayYear = new Date().toISOString().split("-")[0]
  request(`https://date.nager.at/api/v3/PublicHolidays/${todayYear}/UA`).then(responseRaw => {
    const response = JSON.parse(responseRaw)
    const holidays = response.map(x => x.date)
    res.writeHead(200)
    res.end(JSON.stringify(holidays))
  })
}

function getBambooData(req, resGlobal){
  //console.log('bamboo triggered')
  const email = req.query.email

  request(`https://api.bamboohr.com/api/gateway.php/squadukraine/v1/employees/directory`, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Basic ${base64.encode(`bba2d3dbef917fcf5641af77bb4820c274ec7d02:x`)}`
    }
  }).then(responseRaw => {
    const res = JSON.parse(responseRaw)
    const employeeId = res.employees.find(x => x.workEmail === email)
    if (!employeeId) {
      resGlobal.writeHead(404)
      resGlobal.end()
    } else {
      //console.log(employeeId)
      request(`https://api.bamboohr.com/api/gateway.php/squadukraine/v1/employees/${employeeId.id}/?fields=mobilePhone,4414,4416,4415,4417,4413`, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${base64.encode(`bba2d3dbef917fcf5641af77bb4820c274ec7d02:x`)}`
        }
      }).then(data => {
        resGlobal.set({ "Content-Type": "application/json; charset=utf-8" })
        resGlobal.writeHead(200)
        resGlobal.end(data)
      }).catch(err => {
        console.error(err)
      })
    }
  }).catch(err => {
    console.error(err)
  })
}

function getUserData(req, res){
  const id = req.query.id
  const fs = req.query.test ? settings.fs_api.test : settings.fs_api.prod

  getUserInfo(fs.domain, fs.api_key, id).then(userData => {
    if (userData) {
      res.writeHead(200)
      res.end(JSON.stringify(userData))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  function getUserInfo(domain, api_key, id){
    return getRequester(domain, api_key, id).then(res => {
      if (res) {
        return res.requester
      } else {
        return getAgent(domain, api_key, id).then(res => {
          if (res.agent) {
            return res.agent
          } else {
            return false
          }
        })
      }
    })
  }

  function get(url, api_key){
    return request(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${base64.encode(api_key)}`
      }
    }).then(res => {
      return JSON.parse(res)
    }).catch(() => {
      return false
    })
  }

  function getRequester(domain, api_key, id){
    return get(`https://${domain}/api/v2/requesters/${id}`, api_key)
  }

  function getAgent(domain, api_key, id){
    return get(`https://${domain}/api/v2/agents/${id}`, api_key)
  }
}

function getMeidoLogin(req, res){
  const id = req.query.id
  const fs = req.query.test ? settings.fs_api.test : settings.fs_api.prod

  getUserInfo(fs.domain, fs.api_key, id).then(userData => {
    if (userData) {
      res.writeHead(200)
      res.end(JSON.stringify({
        meido: userData.custom_fields.meido_login,
        platforma_parking_spot: userData.custom_fields.personal_parking_spot
      }))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  function getUserInfo(domain, api_key, id){
    return getRequester(domain, api_key, id).then(res => {
      if (res) {
        return res.requester
      } else {
        return getAgent(domain, api_key, id).then(res => {
          if (res.agent) {
            return res.agent
          } else {
            return false
          }
        })
      }
    })
  }

  function get(url, api_key){
    return request(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${base64.encode(api_key)}`
      }
    }).then(res => {
      return JSON.parse(res)
    }).catch(() => {
      return false
    })
  }

  function getRequester(domain, api_key, id){
    return get(`https://${domain}/api/v2/requesters/${id}`, api_key)
  }

  function getAgent(domain, api_key, id){
    return get(`https://${domain}/api/v2/agents/${id}`, api_key)
  }
}

async function getMeidoLocations(req, res){
  const exceptionsTitle = {
    "Lab72-1": "Lab72 / 1"
  }
  try {
    const locations = await request(`https://analytics.getmeido.com/api/fs/location-list?token=${settings.meido_token}`).then(data => { return JSON.parse(data) })
    locations.forEach(location => {
      if (exceptionsTitle[location.title]) location.title = exceptionsTitle[location.title]
    })
    res.writeHead(200)
    res.end(JSON.stringify(locations))
  } catch(e) {
    console.log('--- Meido Locations Error ---')
    console.error(e)
    res.writeHead(500)
    res.end()
  }
}

function normalizePhoneNumber(phoneNumber) {
    //console.log(phoneNumber);
    if (phoneNumber) {
        let cleanNumber = phoneNumber.replace(/[+() -]/g, '');
        if (cleanNumber[0] === '0') {
            cleanNumber = '38' + cleanNumber;
        }
        if (cleanNumber.length === 9) {
            cleanNumber = '380' + cleanNumber;
        }
        if (cleanNumber.length !== 12) {
            //console.log('Длина номера телефона неверна');
            return false;
        }
        return cleanNumber;
    } else {
        //console.log('COULD NOT FIND PHONE NUMBER');
    }
}

async function getParkingIDEntry(req, res){
  /*
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(401, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  */
  if (!req.query.email) {
    res.writeHead(400, 'Not enough data')
    res.end()
    console.error("Error in getParkingIdEntry, query below:")
    console.error(req.query)
    //throw 'Query error'
  }
  const client = await pool.connect()
  try {
    var data = await client.query(`SELECT * FROM parking_id_storage WHERE email = $1;`, [req.query.email])
    //console.log(data.rows)
    if (data.rows.length && data.rows[0].id && data.rows[0].id.length) {
      const responseData = {
        email: data.rows[0].email,
        id: data.rows[0].id
      }
      res.writeHead(200)
      res.end(JSON.stringify(responseData))
    } else {
      res.writeHead(404)
      res.end('Not found!')
    }
  } catch(e) {
    console.log(e)
    res.writeHead(500, "Error!")
    res.end()
  } finally {
    client.release()
  }
}

function updateParkingIDEntry(req, res){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(401, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    const body = JSON.parse(data)
    if (!body.email) {
      res.writeHead(400, 'Not enough data')
      res.end()
      throw 'Payload error'
    }
    const client = await pool.connect()
    try {
      await client.query(`INSERT INTO parking_id_storage(email, id) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET id = $2`, [body.email, body.id === "" ? null : body.id])
      res.writeHead(200, "Success!")
      res.end()
    } catch(e) {
      if (e.code === "23505") {
        const conflict = await client.query(`SELECT * FROM parking_id_storage WHERE id = $1`, [body.id])
        console.log(conflict.rows[0].email)
        const conflictEmail = conflict.rows[0].email
        res.writeHead(403)
        res.end(conflictEmail)
      } else {
        console.error(e)
        res.writeHead(500, "Error!")
        res.end()
      }
    } finally {
      client.release()
    }
  })
}

function replaceParkingIDData(req, res){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(403, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    const rows = JSON.parse(data)
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM parking_id_storage')
      for (let row of rows) {
        const rowParsed = row[1] === "" ? [row[0], null] : row
        if (row[0] !== "") await client.query('INSERT INTO parking_id_storage (email, id) VALUES ($1, $2)', rowParsed)
      }
      res.writeHead(201, "Success")
      res.end()
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error")
      res.end()
    } finally {
      client.release()
    }
  })
}

function handleParkingV2(req, res, type){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(403, 'Wrong access token');
    //console.log(base64.decode(req.headers.authorization), settings.access_token)
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    const body = JSON.parse(data)
    if (!body.id || !body.data) {
      res.writeHead(400)
      res.end('Not enough data')
      throw 'Handle parking v2: payload error'
    }
    const parkingPlatformaAliases = [
      "parking_platforma",
      "parking_platforma_test"
    ]
    var parkingPlatformaId
    if (body.data.parking_platforma_id) {
      parkingPlatformaId = body.data.parking_platforma_id
      delete body.data.parking_platforma_id
    }
    const client = await pool.connect()
    try {
      if (type === "inc") {
        for (let parkingAlias in body.data) {
          if (parkingPlatformaAliases.includes(parkingAlias)) {
            if (parkingPlatformaId) {
              for (let date of body.data[parkingAlias]) {
                await client.query(`INSERT INTO ${parkingAlias}("${parkingPlatformaId}", date) VALUES ($1, $2) ON CONFLICT (date) DO UPDATE SET "${parkingPlatformaId}" = $1;`, [body.id, date])
              }
            }
          } else {
            for (let date of body.data[parkingAlias]) {
              await client.query(`INSERT INTO ${parkingAlias}(id_list, date) VALUES (array[$1], $2) ON CONFLICT (date) DO UPDATE SET id_list = array_append(${parkingAlias}.id_list, $1);`, [body.id, date])
            }
          }
        }
      }
      if (type === "dec") {
        for (let parkingAlias of settings.parking_locations) {
          if (parkingPlatformaAliases.includes(parkingAlias)) {
            for (let date of body.data) {
              const rowData = await client.query(`SELECT * FROM ${parkingAlias} WHERE date = $1`, [date])
              if (rowData.rows.length) {
                var colId
                for (let col in rowData.rows[0]) {
                  if (rowData.rows[0][col] === body.id) colId = col
                }
                if (colId) await client.query(`UPDATE ${parkingAlias} SET "${colId}" = NULL WHERE date = $1`, [date])
              }
            }
          } else {
            for (let date of body.data) {
              await client.query(`UPDATE ${parkingAlias} SET id_list = array_remove(id_list, $1) WHERE date = $2;`, [body.id, date])
            }
          }
        }
      }
      /*
      */
      res.writeHead(200)
      res.end("Success!")
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error!")
      res.end(e)
    } finally {
      client.release()
    }

    /*
    body.dates.forEach(date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.writeHead(400, 'Incorrect date format (expected YYYY-MM-DD)')
        res.end()
        throw 'Payload error (malformed dates)'
      }
    })
    */
  })
}

async function getParking(req, res){
  if (!req.query.cardID) {
    res.writeHead(400, 'Not enough data')
    res.end()
    console.error("Error in getParking, query below:")
    console.error(req.query)
    throw 'Query error'
  }
  const client = await pool.connect()
  const date = req.query.date || new Date().toISOString().split("T")[0]
  //console.log(date)
  try {
    var isParkingAllowed = false
    var parkingId = await client.query(`SELECT * FROM parking_id_storage WHERE id = $1`, [req.query.cardID])
    if (parkingId.rows.length) {
      const queryString = pgformat(`SELECT * FROM %I WHERE date = $1 AND $2 = ANY(id_list);`, `parking${req.query.location ? `_${req.query.location}` : ""}`)
      var data = await client.query(queryString, [date, parkingId.rows[0].email.trim()])
      if (data.rows.length) isParkingAllowed = true
    }
    const responseXML = `<?xml version="1.0" encoding="UTF-8"?><result><access name="${req.query.cardID}">${isParkingAllowed ? 1 : 0}</access><error></error></result>`
    res.set('Content-Type', 'text/xml');
    res.writeHead(200)
    res.end(responseXML)
  } catch(e) {
    console.log(e)
    res.writeHead(500, "Error!")
    res.end()
  } finally {
    client.release()
  }
}

async function getParkingBulk(req, res){
  if (!req.query.dates) {
    res.writeHead(400, 'Not enough data')
    res.end()
    console.error("Error in getParkingBulk, query below:")
    console.error(req.query)
    //throw 'Query error'
  }
  const client = await pool.connect()
  try {
    const dates = JSON.parse(req.query.dates)
    var responseData = {}
    for (let date of dates) {
      const dbData = await client.query(`SELECT * FROM parking WHERE date = $1;`, [date])
      if (dbData.rows.length) {
        responseData[date] = dbData.rows[0].id_list.length
      } else {
        responseData[date] = 0
      }
    }
    res.writeHead(200)
    res.end(JSON.stringify(responseData))
  } catch(e) {
    console.log(e)
    res.writeHead(500, "Error!")
    res.end()
  } finally {
    client.release()
  }
}

function handleCapacityV3(req, res, type){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(403, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    //console.log(data)
    const body = JSON.parse(data)
    /*
    if (!body.office || !body.dates) {
      res.writeHead(400, 'Not enough data')
      res.end()
      throw 'Payload error'
    }
    body.dates.forEach(date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.writeHead(400, 'Incorrect date format (expected YYYY-MM-DD)')
        res.end()
        throw 'Payload error (malformed dates)'
      }
    })
    */
    const client = await pool.connect()
    const email = body.email
    const officeList = body.office
    const today = new Date().toISOString().split("T")[0]
    console.log(body)
    try {
      if (type === "inc") {
        var capacityCheck = true
        var emailExists = {}
        //console.log(body)
        for (let office in officeList) {
          const officeAlias = office.toLowerCase().replace(/ /g, "_")
          emailExists[officeAlias] = {}
          await client.query(pgActions.createCapacityTable(officeAlias))
          for (let date of officeList[office]) {
            const capacity = await client.query(`SELECT emails FROM ${officeAlias} WHERE date = $1;`, [date])
            if (capacity.rows.length && capacity.rows[0].emails.length >= settings.office_capacity[officeAlias]) {
              capacityCheck = false
            }
            if (capacity.rows.length && capacity.rows[0].emails.includes(body.email)) emailExists[officeAlias][date] = true
            //if (officeAlias === settings.avigilon.target_office && date === today) urgentAvigilonUpdate(body.email, "add")
          }
        }
        if (capacityCheck) {
          for (let office in officeList) {
            const officeAlias = office.toLowerCase().replace(/ /g, "_")
            for (let date of officeList[office]) {
              if (!emailExists[officeAlias][date]) await client.query(`INSERT INTO ${officeAlias}(date, emails) VALUES ($1, array[$2]) ON CONFLICT (date) DO UPDATE SET emails = array_append(${officeAlias}.emails, $2);`, [date, email])
            }
          }
          res.writeHead(200, "Success!")
          res.end()
        } else {
          res.writeHead(409, "Capacity exceeded")
          res.end()
        }
      }
      if (type === "dec") {
        for (let office in officeList) {
          const officeAlias = office.toLowerCase().replace(/ /g, "_")
          for (let date of officeList[office]) {
            await client.query(`UPDATE ${officeAlias} SET emails = array_remove(emails, $2) WHERE date = $1;`, [date, email])
            //if (officeAlias === settings.avigilon.target_office && date === today) urgentAvigilonUpdate(body.email, "remove")
          }
          res.writeHead(200, "Success!")
          res.end()
        }
      }
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error!")
      res.end()
    } finally {
      client.release()
    }
  })
}

async function collectCapacityV3(req, res){
  //console.log(req.query)
  if (!req.query.office || !req.query.dates) {
    res.writeHead(400, 'Not enough data')
    res.end()
    console.error("Error in collectCapacityV2, query below:")
    console.error(req.query)
    //throw 'Query error'
  }
  const dates = JSON.parse(req.query.dates)
  const officeList = JSON.parse(req.query.office)
  dates.forEach(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.writeHead(400, 'Not all dates are in correct format (expected YYYY-MM-DD)')
      res.end()
      throw 'Query formatting error'
    }
  })
  const client = await pool.connect()
  try {
    var responseData = {}
    for (let office of officeList) {
      const officeAlias = office.toLowerCase().replace(/ /g, "_")
      responseData[office] = {
        limit: settings.office_capacity[officeAlias],
        capacity: {}
      }
      var data
      try {
        const queryString = pgformat('SELECT * FROM %I WHERE date = ANY($1);', officeAlias)
        data = await client.query(queryString, [dates])
        for (let row of data.rows) {
          responseData[office].capacity[new Date(row.date - row.date.getTimezoneOffset() * 60000).toISOString().split("T")[0]] = row.emails.length
        }
        for (let date of dates) {
          if (!responseData[office].capacity[date]) responseData[office].capacity[date] = 0
        }
      } catch(e) {
        if (e.code === '42P01') {
          for (let date of dates) {
            responseData[office].capacity[date] = 0
          }
        } else {
          console.error(e)
        }
      }
    }
    if (req.query.getparking) {
      const secondaryParking = {
        "Lviv": "parking_lviv",
        "Lviv_test": "parking_lviv_test"
      }
      const parkingAlias = req.query.parkingtest ? "parking_test" : "parking"
      var parkingAliasSearch = parkingAlias
      if (req.query.mainoffice) {
        for (let office in secondaryParking) {
          if (req.query.mainoffice === office) parkingAliasSearch = secondaryParking[office]
        }
      }
      responseData[parkingAlias] = {
        limit: settings.office_capacity[parkingAliasSearch],
        capacity: {}
      }
      for (let date of dates) {
        const queryString = pgformat('SELECT * FROM %I WHERE date = ANY($1);', parkingAliasSearch\)
        const dbData = await client.query(queryString, [date])
        if (dbData.rows.length) {
          responseData[parkingAlias].capacity[date] = dbData.rows[0].id_list.length
        } else {
          responseData[parkingAlias].capacity[date] = 0
        }
      }
    }
    res.writeHead(200)
    res.end(JSON.stringify(responseData))
  } catch(e) {
    //console.error('error!!!!!')
    console.error(e)
    if (e.code === '42P01') {
      res.writeHead(404, "No data for the selected office")
    } else {
      res.writeHead(500, "Error!")
    }
    res.end()
  } finally {
    client.release()
  }
}

async function collectCapacityV4(req, res){
  console.log("v4 get hit")
  //console.log(req.query)
  if (!req.query.office || !req.query.dates) {
    res.writeHead(400, 'Not enough data')
    res.end()
    console.error("Error in collectCapacityV4, query below:")
    console.error(req.query)
    //throw 'Query error'
  }
  const dates = JSON.parse(req.query.dates)
  const officeList = JSON.parse(req.query.office)
  dates.forEach(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.writeHead(400, 'Not all dates are in correct format (expected YYYY-MM-DD)')
      res.end()
      throw 'Query formatting error'
    }
  })
  const client = await pool.connect()
  try {
    const parkingPlatforma = [
      "parking_platforma",
      "parking_platforma_test"
    ]
    var responseData = {}
    for (let office of officeList) {
      const officeAlias = office.toLowerCase().replace(/ /g, "_")
      responseData[office] = {
        limit: settings.office_capacity[officeAlias] || null,
        capacity: {}
      }
      var data
      try {
        const queryString = pgformat('SELECT * FROM %I WHERE date = ANY($1);', officeAlias)
        data = await client.query(queryString, [dates])
        for (let row of data.rows) {
          const dateFormatted = new Date(row.date - row.date.getTimezoneOffset() * 60000).toISOString().split("T")[0]
          var reserved
          if (parkingPlatforma.includes(office)) {
            reserved = row
            delete reserved.date
          } else {
            reserved = row.emails ? row.emails.length : row.id_list.length
          }
          responseData[office].capacity[dateFormatted] = reserved
        }
        for (let date of dates) {
          if (!responseData[office].capacity[date]) responseData[office].capacity[date] = 0
        }
      } catch(e) {
        if (e.code === '42P01') {
          for (let date of dates) {
            responseData[office].capacity[date] = 0
          }
        } else {
          console.error(e)
        }
      }
    }
    res.writeHead(200)
    res.end(JSON.stringify(responseData))
  } catch(e) {
    //console.error('error!!!!!')
    console.error(e)
    if (e.code === '42P01') {
      res.writeHead(404, "No data for the selected office")
    } else {
      res.writeHead(500, "Error!")
    }
    res.end()
  } finally {
    client.release()
  }
}

async function handleInventory(req, res){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(403, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  const email = req.query.email
  const first_date = req.query.first_date
  const last_date = req.query.last_date
  const client = await pool.connect()
  try {
    var filters = []
    var queryData = []
    if (email && email !== "all") {
      filters.push("used_by = ")
      queryData.push(email)
    }
    if (first_date) {
      filters.push("date >= ")
      queryData.push(first_date)
    }
    if (last_date) {
      filters.push("date <= ")
      queryData.push(last_date)
    }
    filters = filters.map((x,i) => x + "$" + (i+1))
    var query = `SELECT * FROM inventory${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""}`
    var data = await client.query(query, queryData)
    //console.log(data)
    res.writeHead(200)
    res.end(JSON.stringify(data.rows))
  } catch(e) {
    console.log(e)
    res.writeHead(500, "Error!")
    res.end()
  } finally {
    client.release()
  }
}

async function updateInventory(req, res){
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(403, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    var rows = JSON.parse(data)
    const client = await pool.connect()
    const date = new Date().toISOString().split("T")[0]
    console.log(rows)
    try {
      for (let row of rows) {
        var rowFlat = []
        rowFlat.push(row.display_name)
        rowFlat.push(row.asset_type)
        rowFlat.push(row.description)
        rowFlat.push(row.asset_tag || null)
        rowFlat.push(row.used_by)
        rowFlat.push(row.location)
        rowFlat.push(row.asset_state)
        rowFlat.push(row.serial_number)
        rowFlat.push(row.finance_name)
        rowFlat.push(row.used_by_name)
        rowFlat.push(row.is_confirmed)
        rowFlat.push(row.comment)
        rowFlat.push(row.extra || null)
        rowFlat.push(date)
        await client.query('INSERT INTO inventory (display_name, asset_type, description, asset_tag, used_by, location, asset_state, serial_number, finance_name, used_by_name, confirmed, comment, extra, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (asset_tag) DO UPDATE SET confirmed = $11, comment = $12, date = $14', rowFlat)
      }
      res.writeHead(201, "Success")
      res.end()
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error")
      res.end()
    } finally {
      client.release()
    }
  })
}

async function replaceInventory(req, res){
  /*
  if (base64.decode(req.headers.authorization) !== settings.access_token) {
    res.writeHead(403, 'Wrong access token');
    res.end();
    throw 'Wrong access token'
  }
  */
  var data = ""
  req.on('data', chunk => {
    data += chunk
  })
  req.on('end', async () => {
    const rows = JSON.parse(data)
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM inventory')
      for (let row of rows) {
        await client.query('INSERT INTO inventory (display_name, asset_type, description, asset_tag, used_by, location, asset_state, serial_number, finance_name, used_by_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', row)
      }
      res.writeHead(201, "Success")
      res.end()
    } catch(e) {
      console.error(e)
      res.writeHead(500, "Error")
      res.end()
    } finally {
      client.release()
    }
  })
}

function avigilonDaily(){
  const today = getTodayWithTimezone()
  const avigilonMappingRaw = fs.readFileSync('./avigilon_mapping.json', "utf8")
  const avigilonMapping = JSON.parse(avigilonMappingRaw)
  avigilon.getIdentityList().then(async identityList => {
    const client = await pool.connect()
    try {
      errorEmails = []
      const dbData = await client.query(`SELECT * FROM avigilon WHERE date = $1;`, [today])
      const emailList = dbData.rows.length ? dbData.rows[0].emails : []
      // ==========
      for (let id in identityList.identity) {
        const identity = identityList.identity[id]
        //console.log(identity)
        const userEmail = identity.plasecidentityEmailaddress._text
        const userCN = identity.cns.cn._text
        var tokenCN

        if (avigilonMapping[userEmail]) {
          tokenCN = avigilonMapping[userEmail]
        } else {
          const tokenData = await avigilon.getToken(userCN).catch(err => { appendError(`Error on ${userEmail}: ${err.message}`) })
          tokenCN = tokenData.cns.cn._text
          avigilonMapping[userEmail] = tokenCN
        }

        if (!settings.avigilon.exception_emails.includes(userEmail)) {
          await avigilon.updateTokenSimple(userCN, tokenCN, emailList.includes(userEmail)).catch(err => { appendError(`Error on ${userEmail}: ${err.message}`) })
        }
      }
      // ==========
    } catch (err) {
      console.log(err)
      appendError(err.message)
      setTimeout(init, 1000)
    } finally {
      client.release()
      fs.writeFileSync('./avigilon_mapping.json', JSON.stringify(avigilonMapping))
      if (errorEmails) appendError(`Error emails: ${errorEmails}`)
    }
  }, err => {
    console.log(err)
    appendError(err.message)
    //setTimeout(init, 10000)
  })

  function appendError(err){
    const now = new Date().toISOString()
    const str = `${now}: ${err}\n`
    fs.appendFileSync('./avigilon_log.txt', str)
  }

}

function officeSpaceParkingDaily(){

}

function getTodayWithTimezone(){
  const todayRaw = new Date()
  todayRaw.setHours(todayRaw.getHours() + 3)
  const today = todayRaw.toISOString()
  return today.split("T")[0]
}
