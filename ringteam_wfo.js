const userId = localStorage.getItem("userId")
const userEmail = localStorage.getItem("userEmail")
const userFullName = localStorage.getItem("userName")

console.log("USER NAME: ", userFullName)
console.log("USER ID: ", userId)

jQuery(document).on('ready', async function(){
  console.log("[REMOTE INIT]")

  const fsNative = {
    //duration: document.getElementById(fsFields.duration),
    support_with_lunch: document.getElementById(fsFields.support_with_lunch).parentNode.childNodes.item(0),
    access_week: document.getElementById(fsFields.access_week),
    lunch_type: document.getElementById(fsFields.lunch_type),
    office: document.getElementById(fsFields.office),
   // meido: document.getElementById(fsFields.meido),
   // meido_text: document.getElementById(fsFields.meido_text),
    dates: getElemList(fsFields.dates),
    additional_locations: getElemList(fsFields.additional_locations),
    document_text: document.getElementById(fsFields.document_text),
    document_check: document.getElementById(fsFields.document_check).parentNode.childNodes.item(0),
    addloc: document.getElementById(fsFields.addloc),
    addloc_text: document.getElementById(fsFields.addloc_text),
    parking: document.getElementById(fsFields.parking),
    car_plate: document.getElementById(fsFields.car_plate)
  }

  var mainWrapper = document.getElementsByClassName("main pull-left")
  if (!mainWrapper.length) mainWrapper = document.getElementsByClassName("main")
  const mainHeader = mainWrapper[0].getElementsByClassName("clearfix")[0]
  const mainCustomFields = document.getElementsByClassName("custom-fields")[0]
  const [covidWrapper, covidDropdownList, covidDropdownMessage] = createCovidQuestions()
  covidDropdownList.forEach(dropdown => {
    dropdown.onchange = function(){ renderController() }
  })
  mainHeader.after(covidWrapper)

  var activeDateCount = 0
  const today = new Date()
  const todayGlobal = today.toLocaleDateString()
  const [thisWeekStart, nextWeekStart] = getWeekStarts()
  const capacityLocations = collectCapacityLocations()
  var selectedDatesGlobal = []
  var capacityCache
  var capacityCheckMain = true
  var capacityCheckAdditional= true
  var additionalLocationInfo = {}
  var addLocationTable
  var lastSelectedOffice
  var fullLocationList = []
  var parkingInfo = []
  var parkingCheck = true
  var hasParkingId = false
  var hasMeidoId = false
  var hasPersonalParkingSpot = false
  var personalParkingSpotId = null
  var covidQuestions = false
  var meidoTimeCheck = false
  var meidoShown = false
  var officeOptionsStorage = {}
  var customMenuOption, vegetarianMenuOption

  //const durationSelector = replaceInputWithDropdown(fsFields.duration, durationList, "duration")
  //durationSelector.parentNode.hidden = true
  const officeSelector = replaceInputWithDropdown(fsFields.office, officeList, "office")
  if (document.getElementById("s2id_requested_item_values_136_requested_item_value_attributes_cf_office_270753")) document.getElementById("s2id_requested_item_values_136_requested_item_value_attributes_cf_office_270753").style.display = "none"
  const accessWeekSelector = replaceInputWithDropdown(fsFields.access_week, accessWeek, "access-week")
  const lunchTypeSelector = createSimplifiedDropdown(fsFields.lunch_type, mealTypes, "lunch_type",true)
  const lunchCheckboxLabel = document.createTextNode("Please support me with lunch")                          // to add text Lunch will be provided in case your visit durayion is more than 2 hours//
  const lunchCheckbox = createCustomCheckbox(document.getElementById(fsFields.support_with_lunch).parentNode, "show-lunch", lunchCheckboxLabel)
  const lunchLviv = document.createElement("p")
  lunchLviv.innerHTML = "Please, pre-order your meals via <a style='color:blue;' href='https://docs.google.com/spreadsheets/d/1jZpc_zn57lgUmz6bVxSuJS6AEnyIc-W6JQczuQq8Q7Q/edit?pli=1#gid=120949263' target='_blank'>this link</a>"
  lunchLviv.style.color = 'black'
  lunchLviv.style.fontSize = "16px"
  lunchTypeSelector.parentNode.after(lunchLviv)
  lunchLviv.hidden = true
  const dateList = createCustomDates(fsNative.dates, parkingActive, true)
  if (parkingActive) {
    dateList.forEach((dateElem, index) => {
      document.getElementById("parking_dropdown_" + (index+1)).onchange = function(){ handleParking(this) }
    })
  }
  const additionalOfficesList = createAdditionalOfficeSelectors(fsFields.additional_locations, officeList)
  const capacityDisplay = createCapacityDisplay(fsNative.dates[0].parentNode.parentNode)
  //--- capacity ---
  if (capacityActive) {
    fsNative.addloc.parentNode.hidden = true
    fsNative.addloc_text.parentNode.hidden = true
    fsNative.additional_locations.forEach(elem => { elem.parentNode.hidden = true })
  }
  for (let office in officeDelay) {
    const option = officeSelector.querySelector(`option[value=${office}]`)
    if (option) {
      officeOptionsStorage[office] = option.cloneNode()
      officeOptionsStorage[office].innerHTML = office
    }
  }


      //add hotDeskCheckbox
  const hotdeskCheckboxLabel = document.createTextNode("I would like to book a hot desk.");
  const hotdeskCheckboxContainer = document.createElement('div');
  const hotdeskPlatformaInfo = document.createElement("p")
  hotdeskPlatformaInfo.innerHTML = "You can find more details about BC Platforma (directions, office facilities, q&a, etc) <a href=\"https://docs.google.com/document/d/1r6dD7tJjHB5AwxGBF-eESlzlYPtG8o8BaWr9NK32R68/edit?usp=sharing\" style='color:blue;cursor:pointer;' target='_blank'>here</a>."
  hotdeskCheckboxContainer.appendChild(hotdeskPlatformaInfo)
  document.getElementById(fsFields.office).parentNode.appendChild(hotdeskCheckboxContainer);
  const hotdeskCheckbox = createCustomCheckbox(hotdeskCheckboxContainer, "show-hotdesk", hotdeskCheckboxLabel);
  hotdeskCheckbox.checked = false;
  const hotdeskText = document.createElement("p");
  hotdeskText.innerHTML = "Please, follow the <a href='https://squad.officespacesoftware.com/visual-directory/floors/162/bookings/new' style='color:blue;cursor:pointer;' target='_blank'>link</a> for hot desks booking system. Here`re <a href='https://docs.google.com/document/d/1llpCz3RbK0cBew7kSJhZPQwD5Om8Kgj0tTq-1kgONx4/edit' style='color:blue;cursor:pointer;' target='_blank'>instructions</a> on how to make a booking.";
  hotdeskCheckboxContainer.appendChild(hotdeskText);

  if (document.getElementById("lunch_type_Custom menu")) {
    customMenuOption = document.getElementById("lunch_type_Custom menu").cloneNode()
    customMenuOption.innerHTML = "Custom menu"
  }
  if (document.getElementById("lunch_type_Vegetarian")) {
    vegetarianMenuOption = document.getElementById("lunch_type_Vegetarian").cloneNode()
    vegetarianMenuOption.innerHTML = "Vegetarian"
  }

  const documentCheckboxLabel = document.createElement("span")
  documentCheckboxLabel.innerHTML = "Я, " + userFullName + ", ознайомився з документом та підтверджую що мій стан відповідає нормам відвідування офісу згідно з заявою.<br>*[✓] <i>означає, що дана відмітка прирівнюється до власноручного/факсимільного відтворення підпису особи.</i>"
  const documentCheckbox = createCustomCheckbox(fsNative.document_check.parentNode, "document-check", documentCheckboxLabel)
  const documentText = createDocumentSection(fsNative.document_text, todayGlobal)

  const dateControlAdd = document.createElement("button")
  dateControlAdd.innerHTML = "+"
  const dateControlRemove = document.createElement("button")
  dateControlRemove.innerHTML = "-"

  lunchCheckbox.parentNode.hidden = true;
  lunchTypeSelector.parentNode.hidden = true;
  hotdeskCheckboxContainer.hidden = true;
  hotdeskText.hidden = true;
  fsNative.parking.parentNode.style.display = "none"
 // fsNative.meido_text.parentNode.hidden = true;
  fsNative.car_plate.parentNode.hidden = true

  //durationSelector.addEventListener("change", function(){ renderController() })
  officeSelector.addEventListener("change", function(){ renderController() })
  accessWeekSelector.addEventListener("change", function(){ renderController() })
  lunchCheckbox.addEventListener("change", function(){ renderController() })
  hotdeskCheckbox.addEventListener("change", function(){ renderController() })
  lunchTypeSelector.addEventListener("change", function(){ renderController() })

  dateList.forEach(dateElem => {
    jQuery(dateElem).datepicker("option", {
      onSelect: function() {
        renderController()
      }
    })
  })

  dateControlAdd.addEventListener("click", function(e){
    e.preventDefault()
    activeDateCount += 1
    renderController()
  })
  dateControlRemove.addEventListener("click", function(e){
    e.preventDefault()
    activeDateCount -= 1
    renderController()
  })
  additionalOfficesList.forEach(elem => {
    elem.addEventListener("change", function(){ renderController() })
  })


  documentCheckbox.addEventListener("change", function(){ renderController() })
/*
  var meidoMenu
  document.getElementById(fsFields.meido).parentNode.style.display = "none"
  if (meidoActive) {
    var elems = document.getElementsByClassName("main pull-left")
    if (!elems.length) elems = document.getElementsByClassName("main")
    meidoMenu = await meidoInit(elems[0], dateList, fsFields.meido, 155, false, fsFields.meido_text)  // change 125 to required limit
    meidoMenu.hidden = true
    renderController()
  } else {
    renderController()
  }
*/
  jQuery("input[type=\"submit\"]").each((index, elem) => {
    elem.onclick = async function(e){
      e.preventDefault()
      if (!covidQuestions) return false
      if (meidoShown && (fsNative.meido.value === "" || fsNative.meido.value === "{}")) {
        alert("Please select meals in the Meido menu")
        return false
      }
      if (parkingLvivCondition()) {
        alert("Please fill out the car plate field")
        return false
      }
/*
    if (!meidoShown) {
        fsNative.meido.value = ""
        fsNative.meido.innerHTML = ""
        if (fsNative.meido_text) {
          fsNative.meido_text.value = ""
          fsNative.meido_text.innerHTML = ""
        }
      }
*/
      if (false) {
        if (!capacityCheckMain || !capacityCheckAdditional || !parkingCheck) {
          renderController(true)
          alert("Please check the capactiy for selected dates")                     //поменять нотифай если нужно!//
        } else {
          document.getElementById("request_catalog_item").submit()
        }
      } else {
        const mainOffice = fsNative.office.value
        const addLocInfo = JSON.parse(fsNative.addloc.innerHTML)
        const data = await fetch(`https://freshservicecounter.ringteam.com/v4/getcapacity?
office=${JSON.stringify(officeCapacity)}
&dates=${selectedDatesGlobal}
&mainoffice=${officeSelector.value}
${parkingActive ? "&getparking=true" : ""}`)
        const json = await data.json()
        var immediateCapacityCheck = true
        for (let office in json) {
          for (let date in json[office].capacity) {
            if (json[office].capacity[date] >= json[office].limit && (office === mainOffice || (addLocInfo[date] && addLocInfo[date].includes(office)))) immediateCapacityCheck = false
          }
        }
        if (!capacityCheckMain || !capacityCheckAdditional || !parkingCheck || !immediateCapacityCheck) {
          renderController(true)
          alert("Please check the capactiy for selected dates")                     //поменять нотифай если нужно!//
        } else {
          document.getElementById("request_catalog_item").submit()
        }
      }
      return e.returnValue
    }
  })

  fetch(`https://freshservicecounter.ringteam.com/getparkingidentry?email=${userEmail}`).then(res => {
    console.log("Parking ID response: ", res.status)
    if (res.status === 200) {
      return res.json()
    } else {
      if (parkingTest) hasParkingId = true
    }
  }).then(res => {
    console.log(res, parkingTest)
    if ((res.id && res.id.length) || parkingTest) hasParkingId = true
  })

  fetch(`https://freshservicecounter.ringteam.com/getmeidologin?id=${userId}${middlewareTestRequests ? "&test=true" : ""}`).then(res => {
    console.log("Meido login response: ", res.status)
    //if (res.status === 200) hasMeidoId = true
    return res.json()
  }).then(res => {
    console.log(res)
    if (res.meido) hasMeidoId = true
    if (res.platforma_parking_spot) personalParkingSpotId = res.platforma_parking_spot
  })


  fetch(`https://freshservicecounter.ringteam.com/getmeidotime`).then(res => {
    return res.json()
  }).then(res => {
    console.log("Meido time check: ", res)
    meidoTimeCheck = res
  })
    renderController()

  function renderController(forceCapacityUpdate = false){
    var values = {
      duration: "Full day",
      office: officeSelector.value,
      access_week: accessWeekSelector.value,
      document_check: documentCheckbox.checked
    }
    const mainOfficeChanged = fsNative.office.value !== values.office.replace(/\./g, "")
    const accessWeekChanged = fsNative.access_week.value !== values.access_week
    //fsNative.duration.value = values.duration === "..." ? "" : values.duration
    fsNative.office.value = values.office === "..." ? "" : values.office
    fsNative.access_week.value = values.access_week === "..." ? "" : values.access_week
    calcFullLocationList()
    console.log(additionalLocationInfo)
    var datesInRequest = dateList.map(x => x.value).filter(x => !!x)
    if (activeDateCount === 0) datesInRequest = datesInRequest[0] ? [datesInRequest[0]] : []
    const today = new Date().toISOString().split("T")[0]
    var weekendOnly = true
    datesInRequest.forEach(date => {
      var weekday = new Date(date).getDay()
      if (weekday !== 6 && weekday !== 0) weekendOnly = false
    })
    // ===============================================
/*
  if (meidoActive && values.access_week === "Next week") {
      meidoCart.calcDateCollection()
    } else {
      fsNative.meido.innerHTML = null
    }
*/
    // ===============================================
    //const showCarPlate = fullLocationList.includes("Lviv") || fullLocationList.includes("Lviv_test")
    fsNative.car_plate.parentNode.hidden = !parkingLvivCondition()
    // ===============================================
    handleOfficeDelay()
    checkCovidQuestions()
    displayHotdeskSection()
    // ===============================================
    const firstDate = new Date(datesInRequest[0]).valueOf() || 0
    const boundary = new Date("2022-02-21").valueOf()
    if ((values.office === "Lviv" || values.office === "Lviv_test") && firstDate < boundary) {
      hotdeskCheckboxContainer.hidden = true
    }
    // ===============================================
    handleParkingOptions()
    handleLunchSection()
    handleDates()
    renderDocument()
    if (capacityActive) {
      handleAddLocCollection()
      handleCapacity()
    }
    // ===============================================
    // ===============================================
    // ===============================================
    function handleOfficeDelay(){
      for (let office in officeDelay) {
        if (
          (nextWeekStart >= officeDelay[office] && values.access_week === "Next week")
          || (thisWeekStart >= officeDelay[office])
        ) {
          if (!officeSelector.querySelector(`option[value=${office}]`) && officeOptionsStorage[office]) officeSelector.appendChild(officeOptionsStorage[office])
        } else {
          if (officeSelector.querySelector(`option[value=${office}]`)) officeSelector.querySelector(`option[value=${office}]`).remove()
        }
      }
    }

    function checkCovidQuestions(){
      covidQuestions = true
      covidAllSelected = true
      covidDropdownList.forEach(covidDropdown => {
        if (covidDropdown.value !== "No") covidQuestions = false
        if (covidDropdown.value === "...") covidAllSelected = false
      })
      if (covidQuestions) {
        mainCustomFields.hidden = false
        documentCheckbox.checked = true
      } else {
        mainCustomFields.hidden = true
        documentCheckbox.checked = false
      }
      covidDropdownMessage.hidden = !(!covidQuestions && covidAllSelected)
    }

    function handleAddLocCollection(){
      if (values.office === "...") {
        lastSelectedOffice = values.office
        for (let elem of document.getElementsByClassName("addtable-container")) {
          elem.innerHTML = ""
        }
        additionalLocationInfo = {}
        populateAddLocationField()
      }
      if (values.office !== "..." && values.office !== lastSelectedOffice) {
        lastSelectedOffice = values.office
        addLocationTable = buildAddLocationTable(values.office)
        const addTableContainers = document.getElementsByClassName("addtable-container")
        var index = 1
        for (let elem of addTableContainers) {
          elem.innerHTML = ""
          const table = addLocationTable.cloneNode(true)
          for (let elem of table.querySelectorAll('.add-office-label')) {
            elem.htmlFor = elem.htmlFor + "_" + index
          }
          for (let elem of table.querySelectorAll('.add-office-checkbox')) {
            elem.id = elem.id + "_" + index
            elem.onclick = function(){ handleAddLocation(this) }
          }
          ++index
          elem.appendChild(table)
        }
        additionalLocationInfo = {}
        populateAddLocationField()
      }
    }

    function displayHotdeskSection(){
      console.log("rendering hotdesk section")
      hotdeskPlatformaInfo.style.display = "none"
      if (fsNative.office.value === 'BC Platforma'
        || fsNative.office.value === 'Lviv'
        || fsNative.office.value === 'BC Platforma_test'
        || fsNative.office.value === 'Lviv_test'
        || fsNative.office.value === "Uzhhorod"
      ) {
        hotdeskCheckboxContainer.hidden = false;
        hotdeskPlatformaInfo.style.display = "block"
      } else {
        hotdeskCheckbox.checked = false;
        hotdeskCheckboxContainer.hidden = true;
      }
      if (values.office === "BC Platforma" || values.office === "BC Platforma_test") {
        hotdeskPlatformaInfo.innerHTML = "You can find more details about BC Platforma (directions, office facilities, q&a, etc) <a href=\"https://docs.google.com/document/d/1r6dD7tJjHB5AwxGBF-eESlzlYPtG8o8BaWr9NK32R68/edit?usp=sharing\" style='color:blue;cursor:pointer;' target='_blank'>here</a>."
        hotdeskText.innerHTML = "Please, follow the <a href='https://squad.officespacesoftware.com/visual-directory/floors/162/bookings/new' style='color:blue;cursor:pointer;' target='_blank'>link</a> for hot desks booking system. Here`re <a href='https://docs.google.com/document/d/1llpCz3RbK0cBew7kSJhZPQwD5Om8Kgj0tTq-1kgONx4/edit' style='color:blue;cursor:pointer;' target='_blank'>instructions</a> on how to make a booking."
      }
      if (values.office === "Lviv" || values.office === "Lviv_test") {
        hotdeskPlatformaInfo.innerHTML = "You can find more details about Lviv Office (directions, office facilities, q&a, etc) <a href=\"https://docs.google.com/document/d/1ZgjWTrqoTiQhQaPM7VXrdZWow0SnzDevyYCCDTak5FE/edit?pli=1\" style='color:blue;cursor:pointer;' target='_blank'>here</a>."
        hotdeskText.innerHTML = "Please, follow the <a href='https://squad.officespacesoftware.com/visual-directory/floors/131' style='color:blue;cursor:pointer;' target='_blank'>link</a> for hot desks booking system. Here're <a href='https://docs.google.com/document/d/1ky9iDcEO7I3Mh4xCGALTHN-eqcl7K8zKmZOlWiF4sNM/edit' style='color:blue;cursor:pointer;' target='_blank'>instructions</a> on how to make a booking."
      }
      if (values.office === "Uzhhorod" || values.office === "Uzhhorod_test") {
        hotdeskPlatformaInfo.innerHTML = ""
        hotdeskText.innerHTML = "Please, follow the <a href='https://squad.officespacesoftware.com/visual-directory/floors/207' style='color:blue;cursor:pointer;' target='_blank'>link</a> for hot desks booking system. Here're <a href='https://docs.google.com/document/d/1ky9iDcEO7I3Mh4xCGALTHN-eqcl7K8zKmZOlWiF4sNM/edit' style='color:blue;cursor:pointer;' target='_blank'>instructions</a> on how to make a booking."
      }
      if (!hotdeskCheckbox.checked) {
        hotdeskText.hidden = true;
      } else {
        hotdeskText.hidden = false;
      }
    }

    function handleParkingOptions(){
      for (let optionName in parkingSettings) {
        const selectOptions = document.getElementsByClassName("parking-option-" + optionName)
        for (let elem of selectOptions) {
          elem.style.display = parkingSettings[optionName].officeList.includes(values.office) ? "block" : "none"
          if (optionName.startsWith("parking_platforma")) {
            //console.log("personal id:", personalParkingSpotId)
            if (personalParkingSpotId) {
              elem.innerHTML = parkingSettings[optionName].label + ", spot #" + personalParkingSpotId
              if (jQuery(elem).parent().is("span")) $(elem).unwrap()
            } else {
              elem.style.display = "none"
              if (!jQuery(elem).parent().is("span")) $(elem).wrap("<span>")
            }
          }
        }
      }
      // ========================
      if (dateList[0].value === today) {
        document.getElementById("parking_option_parking_platforma_test_1").style.display = "none"
      }
      // ========================
      if (mainOfficeChanged || accessWeekChanged) {
        const parkingDropdowns = document.getElementsByClassName("parking-dropdown")
        for (let dropdown of parkingDropdowns) {
          dropdown.value = "no-parking"
        }
        handleParking()
      }
    }

    function displayParking(){
      const parkingElems = document.getElementsByClassName("parkingwrapper")
      const dateBoundary = new Date('2021-05-17') // use in conjunction with condition below to temporarily disable parking
      const nowLocal = new Date()
      if (officeParking.includes(values.office) && hasParkingId && (dateBoundary < nowLocal || values.access_week === "Next week")) {
        for(let elem of parkingElems) {
          elem.style.display = "inline-flex"
        }
      } else {
        for(let elem of parkingElems) {
          elem.style.display = "none"
          elem.querySelector("input").checked = false
        }
      }

      // ================================================
      // optional section for disabling Lviv parking for the current week
      // unlikely to become useful again, but you never know...
      // ================================================
      /*
      if (parkingActive && parkingLvivNoCurrentWeek) {
        const parkingElems = document.getElementsByClassName("parkingwrapper")
        if ((values.office === "Lviv" && values.access_week === "Current week") || !officeParking.includes(values.office)) {
          for (let item of parkingElems) {
            item.style.display = "none"
          }
        } else {
          for (let item of parkingElems) {
            item.style.display = "inline-flex"
          }
        }
      }
      */
    }

    function checkParkingConditions(){
      const dateBoundary = new Date('2021-05-17') // use in conjunction with condition below to temporarily disable parking
      const nowLocal = new Date()
      console.log("PARKING CONDITIONS: ", officeParking.includes(values.office), hasParkingId)
      return officeParking.includes(values.office) && hasParkingId && (dateBoundary < nowLocal || values.access_week === "Next week") && parkingActive
    }

    function handleLunchSection(){
      if (durationList[values.duration] && officeList[values.office] && accessWeek[values.access_week] && datesInRequest.length && !(datesInRequest.length === 1 && datesInRequest[0] === today) && !accessWeekChanged && !weekendOnly && datesInRequest[datesInRequest.length-1] >= "2022-04-26") {
        lunchCheckbox.parentNode.hidden = false
      } else {
        lunchCheckbox.parentNode.hidden = true
        lunchCheckbox.checked = false
      }

      values.support_with_lunch = lunchCheckbox.checked
      fsNative.support_with_lunch.value = lunchCheckbox.checked ? "1" : "0"
      if (values.support_with_lunch && values.office !== "Uzhhorod") {
        if (/*values.office === "Lviv" || values.office === "Lviv_test"*/false) {
          lunchTypeSelector.parentNode.hidden = true
          lunchTypeSelector.value = null
          lunchLviv.hidden = false
          meidoShown = false
          if (meidoActive)  fsNative.meido.value = ""
        } else {
          lunchLviv.hidden = true
          lunchTypeSelector.parentNode.hidden = false
          lunchTypeSelector.value = lunchTypeSelector.value || "Standard"
        }
      } else {
        lunchTypeSelector.parentNode.hidden = true
        lunchTypeSelector.value = values.support_with_lunch ? lunchTypeSelector.value || "Standard" : null
        if (meidoActive === true) meidoMenu.hidden = true
        meidoShown = false
        lunchLviv.hidden = true
        if (meidoActive) fsNative.meido.value = ""
      }

      if (meidoTimeCheck && values.access_week !== "Current week" && officeMeido[values.office] && hasMeidoId && meidoActive) {
        if (!document.getElementById("lunch_type_Custom menu")) lunchTypeSelector.appendChild(customMenuOption)
      } else {
        if (document.getElementById("lunch_type_Custom menu")) document.getElementById("lunch_type_Custom menu").remove()
      }

      if (values.office.startsWith("BC Platforma")) {
        if (!document.getElementById("lunch_type_Vegetarian")) lunchTypeSelector.appendChild(vegetarianMenuOption)
      } else {
        if (document.getElementById("lunch_type_Vegetarian")) document.getElementById("lunch_type_Vegetarian").remove()
      }

      if (meidoActive) {
        meidoShown = lunchTypeSelector.value === "Custom menu"
        meidoMenu.hidden = !meidoShown
      }

      values.lunch_type = lunchTypeSelector.value
      fsNative.lunch_type.value = values.lunch_type ? values.lunch_type : ""
    }

    function handleDates(){
      const dateLimits = (values.access_week === "...") ? null : calcDateLimits(values.access_week === "Current week")
      const dateLimitsRaw = dateLimits ? dateLimits.map(x => new Date(x).valueOf()) : null
      var existingDates = []
      var lastUsedFound = false
      if (accessWeekChanged) activeDateCount = 0
      dateList.forEach((dateElem, index) => {
        // =====================================================
        const dateNativeElem = fsNative.dates[index]
        const timeNativeElem = document.getElementById(fsFields.dates[index].substring(0, fsFields.dates[index].length - 4) + "time")
        // =====================================================
        const errorElem = document.getElementById("date_custom_" + (index+1) + "-error")
        if (errorElem) errorElem.style.display = "none"
        // =====================================================
        if (accessWeekChanged && index === 0) dateElem.value = null
        const dateRawValue = new Date(dateElem.value).valueOf()
        if (existingDates.includes(dateRawValue)) dateElem.value = null
        dateElem.disabled = true
        if (dateLimits) {
          jQuery("#date_custom_"+(index+1)).datepicker("option", {
            minDate: new Date(dateLimits[0]),
            maxDate: new Date(dateLimits[1])
          })
          dateElem.disabled = false
          if (dateRawValue < dateLimitsRaw[0] || dateRawValue > dateLimitsRaw[1]) dateElem.value = null
        }
        existingDates.push(dateRawValue)
        const addLocationWrapper = document.getElementById("addtable_wrapper_" + (index+1))
        const addLocations = document.getElementById("addtable_" + (index+1)).querySelectorAll('.add-office-checkbox')
        const parkingWrapper = document.getElementById("parkingwrapper_" + (index+1))
        const parkingDropdown = document.getElementById("parking_dropdown_" + (index+1))
        if (dateElem.value && dateElem.value !== "") {
          dateNativeElem.value = reverseForFS(dateElem.value)
          timeNativeElem.value = "00:00"
          if (capacityActive) addLocationWrapper.style.display = "block"
          if (parkingActive) {
            console.log("parking active, conditions: ", checkParkingConditions())
            if (checkParkingConditions()) {
              parkingWrapper.show()
            } else {
              parkingWrapper.hide()
            }
          }
        } else {
          dateNativeElem.value = null
          timeNativeElem.value = null
          if (capacityActive) {
            addLocationWrapper.style.display = "none"
            for (let checkbox of addLocations) {
              checkbox.checked = false
            }
          }
          if (parkingActive) {
            parkingWrapper.hide()
            parkingDropdown.value = "no-parking"
          }
        }
        // calendar controls (+/- buttons)
        const controlWrapper = document.getElementById("controls_" + index)
        controlWrapper.innerHTML = ""
        if (index < activeDateCount) {
          dateElem.disabled = true
          dateElem.parentNode.style.display = "block"
        } else if (index === activeDateCount) {
          if (dateLimits) dateElem.disabled = false
          if (index > 0 && dateList[index-1].value) {
            const nextDate = new Date(dateList[index-1].value)
            nextDate.setDate(nextDate.getDate() + 1)
            jQuery("#date_custom_"+(index+1)).datepicker("option", {
              minDate: nextDate
            })
          }
          dateElem.parentNode.style.display = "block"
          if (activeDateCount > 0) controlWrapper.appendChild(dateControlRemove)
          if (activeDateCount < dateList.length-1) {
            controlWrapper.appendChild(dateControlAdd)
            dateControlAdd.disabled = !dateElem.value
          }
        } else {
          dateElem.parentNode.style.display = "none"
          dateElem.value = null
          dateNativeElem.value = null
          timeNativeElem.value = null
        }
      })
    }

    function handleCapacity(){
      const selectedDates = dateList.map(x => x.value).filter(x => !!x)
      for (let date in additionalLocationInfo) {
        if (!selectedDates.includes(date)) delete additionalLocationInfo[date]
      }
      populateAddLocationField()
      if ((selectedDates.length && JSON.stringify(selectedDates) !== selectedDatesGlobal)
      || mainOfficeChanged
      || forceCapacityUpdate) {
        fetch(`https://freshservicecounter.ringteam.com/v4/getcapacity?
office=${JSON.stringify(capacityLocations)}
&dates=${JSON.stringify(selectedDates)}`)
        .then(res => {
          return res.json()
        }).then(res => {
          console.log("Capacity data: ", res)
          capacityCache = res
          var mainLocationFound = false
          for (let officeName in res) {
            if (values.office === officeName) {
              // main capacity
              mainLocationFound = true
              capacityCheckMain = true
              capacityDisplay.innerHTML = ""
              const office = document.createElement("div")
              office.innerHTML = `<b>Office:</b> ${officeName}`
              const limit = document.createElement("div")
              limit.innerHTML = `<b>Limit:</b> ${res[officeName].limit} visitors per day`
              limit.style.borderBottom = "1px dotted grey"
              capacityDisplay.appendChild(office)
              capacityDisplay.appendChild(limit)
              var capacityDataArray = []
              for (let date in res[officeName].capacity) {
                capacityDataArray.push({ date: date, capacity: res[officeName].capacity[date] })
              }
              capacityDataArray.sort((x,y) => { return x.date > y.date ? 1 : -1 })
              capacityDataArray.forEach(obj => {
                const dateElem = document.createElement("div")
                dateElem.innerHTML = `<b>${obj.date}:</b> ${obj.capacity} visitors confirmed`
                if (obj.capacity / res[officeName].limit >= 0.7) dateElem.style.color = "orange"
                if (obj.capacity >= res[officeName].limit) {
                  dateElem.style.color = "red"
                  capacityCheckMain = false
                }
                capacityDisplay.appendChild(dateElem)
              })
              if (selectedDates.length) capacityDisplay.hidden = false
            } else {
              //additional capacity
              dateList.forEach((dateElem, index) => {
                if (dateElem.value) {
                  if (parkingSettings[officeName]) {
                    appendParkingCapacity(officeName, res[officeName], index, dateElem.value)
                  } else {
                    var elem = dateElem.parentNode.getElementsByClassName("capacity_" + officeName)[0]
                    elem.style.color = "black"
                    elem.innerHTML = `approved ${res[officeName].capacity[dateElem.value]}/limit ${res[officeName].limit}`
                    if (res[officeName].capacity[dateElem.value] >= res[officeName].limit) {
                      elem.style.color = "red"
                    }
                  }
                }
              })
            }
          }
          if (!mainLocationFound) capacityDisplay.hidden = true
        })
      } else if (!selectedDates.length) {
        capacityDisplay.hidden = true
        capacityCheckMain = true
        capacityCheckAdditional = true
      }
      selectedDatesGlobal = JSON.stringify(selectedDates)
    }

  }

  function appendParkingCapacity(parking, data, index, date){
    const option = document.getElementById(`parking_option_${parking}_${index+1}`)
    const text = parkingSettings[parking].label || "Book a parking spot"
    if (parkingSettings[parking].parkingPlatforma && personalParkingSpotId) {
      console.log(data, date, personalParkingSpotId)
      var spotLabel = personalParkingSpotId
      if (spotLabel[0] === "0") spotLabel = spotLabel.substring(1)
      option.innerHTML = `${text}, seat #${spotLabel}`
      if (data.capacity[date] && data.capacity[date][personalParkingSpotId]) option.innerHTML += " (already occupied)"
      option.disabled = data.capacity[date][personalParkingSpotId]
    } else if (parkingSettings[parking].hasCapacity) {
      option.innerHTML = `${text} (approved ${data.capacity[date]}/limit ${data.limit})`
      option.disabled = data.capacity[date] >= data.limit
    }
  }

  function renderDocument(){
    fsNative.document_check.value = documentCheckbox.checked ? "1" : "0"
    fsNative.document_check.checked = documentCheckbox.checked
    const documentLocations = fullLocationList.map(x => officeAddress[x]).filter(x => !!x).join(", ")
    document.getElementById("doc-address").innerHTML = documentLocations
    // =================================================
    var text = `Заява на допуск до користування Простором Товариства з обмеженою відповідальністю «ТекХостинг» (далі – ТОВ «ТекХостинг»)

    Я, фізична особа-підприємець ${userFullName}, виявляю добровільне бажання та прошу допустити мене до користування офісним простором ТОВ «ТекХостинг» (далі – Простір), що знаходиться за адресою: ${documentLocations}. При цьому усвідомлюю ризики, які можуть скластися у зв'язку з воєнним станом введеним Указом Президента України № 64/2022 від  24 лютого 2022 року.


    Я підтверджую, що на момент надання мені доступу до користування Простором:

    • у мене відсутні будь-які ознаки ГРВІ, а саме: підвищена температура тіла (більше 37,2 С), кашель, утруднене дихання тощо;
    • я ознайомлений(а) з рекомендаціями МОЗ та ВООЗ щодо попередження зараження COVID-19 та їх дотримуюсь;
    • протягом останніх 7 днів я не перебував(ла) за межами України та протягом останніх 7 днів не контактував(ла) з особами, щодо яких наявна підозра/хворими на COVID-19.

    Я зобов’язуюсь під час користування Простором дотримуватися посилених санітарно-гігієнічних норм, а також рекомендацій МОЗ та ВООЗ щодо запобігання поширенню COVID-19, а саме:

    • носити медичну маску/респіратор;
    • ретельно мити руки з милом протягом 20-40 сек. та регулярно обробляти їх антисептичним засобом під час перебування в Просторі;
    • дотримуватися дистанції min 1,5 (півтора) метри від інших відвідувачів Простору.

    Я розумію, що при оголошенні повітряної тривоги необхідно негайно покинути приміщення Простору та зайняти місце у захисній споруді (сховищі, підвальному приміщенні), а також дотримуватися рекомендацій та правил органів державної влади та місцевого самоврядування.

    Дата: ${todayGlobal}`
    // =================================================
    fsNative.document_text.value = text
  }

  function buildAddLocationTable(excluded){
    const table = document.createElement('table')
    table.style.margin = "10px"
    const row = document.createElement('tr')
    row.style.width = "800px"
    row.style.display = "block"
    table.appendChild(row)
    var cellCount = 0
    for (let office in officeList) {
      if (office !== "..." && office !== excluded) {
        var currentRow
        if (cellCount <= 2) {
          currentRow = table.childNodes[table.childNodes.length - 1]
          ++cellCount
        } else {
          currentRow = document.createElement('tr')
          table.appendChild(currentRow)
          cellCount = 1
        }
        const cell = document.createElement('td')
        cell.style.display = "inline-flex"
        const label = document.createElement('label')
        label.htmlFor = office
        label.className += "add-office-label"
        label.innerHTML = office
        const checkbox = document.createElement('input')
        checkbox.type = "checkbox"
        checkbox.id = office
        checkbox.className += "add-office-checkbox"
          //checkbox.style.display = "inline-block"
        checkbox.style.marginRight = "5px"
        const capacity = document.createElement('span')
        capacity.className += "capacity_" + office
          //capacity.style.display = "inline-block"
        capacity.style.marginLeft = "10px"

        cell.appendChild(checkbox)
        cell.appendChild(label)
        cell.appendChild(capacity)
        cell.style.width = "33%"
        currentRow.appendChild(cell)
      }
    }
    return table
  }

  function handleAddLocation(elem){
    const dateId = elem.id[elem.id.length - 1]
    const locationName = elem.id.substring(0, elem.id.length - 2)
    const dateElem = document.getElementById("date_custom_" + dateId)
    if (elem.checked) {
      if (!additionalLocationInfo[dateElem.value]) additionalLocationInfo[dateElem.value] = []
      additionalLocationInfo[dateElem.value].push(locationName)
    } else {
      const removed = additionalLocationInfo[dateElem.value].splice(additionalLocationInfo[dateElem.value].indexOf(locationName), 1)
      if (!additionalLocationInfo[dateElem.value].length) delete additionalLocationInfo[dateElem.value]
    }
    populateAddLocationField()
    calcFullLocationList()
    renderDocument()
  }

  function populateAddLocationField(){
    fsNative.addloc.innerHTML = JSON.stringify(additionalLocationInfo)
    var text = []
    for (let date in additionalLocationInfo) {
      text.push(`${date}: ${additionalLocationInfo[date].join(", ")}`)
    }
    fsNative.addloc_text.innerHTML = text.join("; \n")
    for (let date in additionalLocationInfo) {
      for (let addOffice of additionalLocationInfo[date]) {
        if (capacityCache[addOffice] && capacityCache[addOffice].capacity[date] >= capacityCache[addOffice].limit) capacityCheckAdditional = false
      }
    }
  }

  function handleParking(elem){
    /*
    const dateId = elem.id[elem.id.length - 1]
    const dateElem = document.getElementById("date_custom_" + dateId)
    if (elem.checked) {
      parkingInfo.push(dateElem.value)
    } else {
      parkingInfo.splice(parkingInfo.indexOf(dateElem.value), 1)
    }
    fsNative.parking.innerHTML = JSON.stringify(parkingInfo)
    checkParking()
    */
    const parkingLocal = {}
    const parkingDropdowns = document.getElementsByClassName("parking-dropdown")
    for (let dropdown of parkingDropdowns) {
      const dateId = dropdown.id[dropdown.id.length - 1]
      const dateElem = document.getElementById("date_custom_" + dateId)
      if (dateElem.value && dropdown.value !== "no-parking") {
        if (!parkingLocal[dropdown.value]) parkingLocal[dropdown.value] = []
        parkingLocal[dropdown.value].push(dateElem.value)
      }
    }
    if (personalParkingSpotId) parkingLocal.parking_platforma_id = personalParkingSpotId
    fsNative.car_plate.parentNode.hidden = !parkingLvivCondition()
    parkingInfo = parkingLocal
    fsNative.parking.innerHTML = JSON.stringify(parkingInfo)
  }

  function checkParking(){
    var selectedParking = []
    dateList.forEach((dateElem, index) => {
      var checkbox = document.getElementById("parking_" + (index+1))
      if (checkbox.checked) selectedParking.push(dateElem.value)
    })
    parkingCheck = true
    selectedParking.forEach(date => {
      if (parkingTest) {
        if (capacityCache.parking_test.capacity[date] >= capacityCache.parking_test.limit) parkingCheck = false
      } else {
        if (capacityCache.parking.capacity[date] >= capacityCache.parking.limit) parkingCheck = false
      }
    })
  }

  function calcFullLocationList(){
    const locations = new Set()
    locations.add(fsNative.office.value)
    for (let date in additionalLocationInfo) {
      additionalLocationInfo[date].forEach(loc => { locations.add(loc) })
    }
    fullLocationList = Array.from(locations)
  }

  function parkingLvivCondition(){
    return ((fsNative.office.value === "Lviv" || fsNative.office.value === "Lviv_test") && (fsNative.parking.value !== "" && fsNative.parking.value !== "[]" && fsNative.parking.value !== "{}")) && !fsNative.car_plate.value
  }
})

function replaceInputWithDropdown(targetId, dataset, facsId = null){
  const nativeContainer = document.getElementById(targetId).parentNode
  document.getElementById(targetId).style.display = "none"
  const selector = document.createElement("select")
  selector.id = facsId
  for (let optionName in dataset) {
    const option = document.createElement("option")
    option.innerHTML = optionName
    option.value = optionName
    selector.appendChild(option)
  }
  nativeContainer.appendChild(selector)
  return selector
}

function createSimplifiedDropdown(targetId, dataset, facsId = null, addId = false){
  const nativeContainer = document.getElementById(targetId).parentNode
  document.getElementById(targetId).style.display = "none"
  const selector = document.createElement("select")
  selector.id = facsId
  dataset.forEach(optionName => {
    const option = document.createElement("option")
    option.innerHTML = optionName
    option.value = optionName
    if (addId) option.id = (facsId || "dropdown") + "_" + optionName
    selector.appendChild(option)
  })
  nativeContainer.appendChild(selector)
  return selector
}

function createCustomCheckbox(container, id, labelText){
  container.childNodes.forEach(elem => {
    elem.style.display = "none"
  })
  const checkboxWrapper = document.createElement("div")
  const checkbox = document.createElement("input")
  checkbox.type = "checkbox"
  checkbox.id = id
  const checkboxLabel = document.createElement("label")
  checkboxLabel.htmlFor = id
  checkboxLabel.style.display = "inline"
  checkboxLabel.style.marginLeft = "5px"
  checkboxLabel.appendChild(labelText)
  checkboxWrapper.appendChild(checkbox)
  checkboxWrapper.appendChild(checkboxLabel)
  container.appendChild(checkboxWrapper)
  return checkbox
}

function createCustomDates(nativeList, parkingActive, createAddLocation = false){
  var customDateCollection = []
  nativeList.forEach((dateNativeField, index) => {
    dateNativeField.parentNode.style.display = "none"
    const dateField = document.createElement("input")
    dateField.setAttribute("autocomplete", "off")
    const elemId = "date_custom_" + (index + 1)
    dateField.id = elemId
    const controlWrapper = document.createElement("span")
    controlWrapper.id = "controls_" + index
    controlWrapper.style.marginLeft = "5px"
    controlWrapper.style.minWidth = "50px"
    controlWrapper.style.display = "inline-block"
    dateNativeField.parentNode.parentNode.append(dateField)
    dateNativeField.parentNode.parentNode.append(controlWrapper)

    if (createAddLocation) {
      const addLocationWrapper = createAddLocationSection(index)
      dateNativeField.parentNode.parentNode.appendChild(addLocationWrapper)
    }
    if (parkingActive) {
      const parkingWrapper = createParkingSection(index)
      dateNativeField.parentNode.parentNode.appendChild(parkingWrapper)
    }

    if (index > 0) dateNativeField.parentNode.parentNode.style.display = "none"
    customDateCollection.push(dateField)
    jQuery("#"+elemId).datepicker({
      dateFormat: "yy-mm-dd",
      firstDay: 1
    })
  })
  return customDateCollection

  function createAddLocationSection(index){
    const addLocationWrapper = document.createElement("div")
    addLocationWrapper.className += "addtable_wrapper"
    addLocationWrapper.id = "addtable_wrapper_" + (index+1)
    const addLocationHeader = document.createElement("div")
    addLocationHeader.style.textColor = "lightgrey"
    addLocationHeader.style.fontSize = "16px"
    const addLocationArrow = document.createElement("span")
    addLocationHeader.appendChild(addLocationArrow)
    addLocationArrow.innerHTML = "►"
    addLocationHeader.innerHTML += "Select additional locations"
    const addLocationTableContainer = document.createElement("div")
    addLocationTableContainer.id = "addtable_" + (index+1)
    addLocationTableContainer.className += "addtable-container"
    jQuery(addLocationTableContainer).hide()
    addLocationHeader.onclick = function(){
      jQuery(addLocationTableContainer).toggle(200)
      addLocationArrow.innerHTML = (addLocationArrow.innerHTML === "►") ? "▼" : "►"
    }
    addLocationWrapper.appendChild(addLocationHeader)
    addLocationWrapper.appendChild(addLocationTableContainer)
    return addLocationWrapper
  }

  function createParkingSection(index){
    const parkingWrapper = document.createElement("div")
    parkingWrapper.className += "parkingwrapper"
    parkingWrapper.id = "parkingwrapper_" + (index+1)
    parkingWrapper.style.display = "block"
    parkingWrapper.hide = function(){
      parkingWrapper.style.display = "none"
    }
    parkingWrapper.show = function(){
      parkingWrapper.style.display = "block"
    }
    const parkingLabel = document.createElement("label")
    parkingLabel.innerHTML = "Parking"
    const parkingDropdown = document.createElement("select")
    parkingDropdown.className += "parking-dropdown"
    parkingDropdown.id = "parking_dropdown_" + (index+1)
    parkingDropdown.style.border = "3px solid #70c9e9"
    parkingDropdown.style.padding = "1px"
    // ===========================
    const noParkingOption = document.createElement("option")
    noParkingOption.innerHTML = "I don't need parking"
    noParkingOption.value = "no-parking"
    parkingDropdown.appendChild(noParkingOption)
    // ===========================
    for (let parkingOption in parkingSettings) {
      const option = document.createElement("option")
      option.className = "parking-option-" + parkingOption
      option.id = "parking_option_" + parkingOption + "_" + (index+1)
      option.value = parkingOption
      option.innerHTML = parkingSettings[parkingOption].label || "Book a parking spot"
      parkingDropdown.appendChild(option)
    }
    // ===========================
    parkingWrapper.appendChild(parkingLabel)
    parkingWrapper.appendChild(parkingDropdown)
    return parkingWrapper
  }
}

function createInputWithRestrictions(elem, pattern){
  const parent = elem.parentNode
  const input = document.createElement("input")
  if (pattern) input.pattern = pattern
  elem.style.display = "none"
  parent.appendChild(input)
  return input
}

function createDocumentSection(target, todayGlobal){
  target.parentNode.childNodes.forEach(node => {
    node.style.display = "none"
  })
  const documentTextWrapper = document.createElement("div")
  const documentTextHeader = document.createElement("div")
  documentTextHeader.style.fontSize = "16px"
  const headerArrow = document.createElement("span")
  headerArrow.innerHTML = "►"
  const headerTitle = document.createElement("span")
  headerTitle.innerHTML = "Текст документа (click to view)"
  documentTextHeader.appendChild(headerArrow)
  documentTextHeader.appendChild(headerTitle)
  const documentTextContent = document.createElement("div")
  documentTextHeader.onclick = function(){
    documentTextContent.hidden = !documentTextContent.hidden
    headerArrow.innerHTML = (headerArrow.innerHTML === "►" ? "▼" : "►")
  }
  documentTextContent.style.width = "600px"
  documentTextContent.style.margin = "15px"
  const nameFixed = userFullName.replace(/'/g, "&#39;")
  documentTextContent.insertAdjacentHTML('beforeend', '<div style="text-align: center">         <b>Заява на допуск до користування Простором Товариства з обмеженою відповідальністю «ТекХостинг» (далі – ТОВ «ТекХостинг»)</b>       </div>       <br>       <div style="text-align: justify">         <p>           Я, <b>фізична особа-підприємець</b> '+nameFixed+', виявляю добровільне бажання та прошу допустити мене до користування офісним простором ТОВ «ТекХостинг» (далі – Простір), що знаходиться за адресою: <span id="doc-address"></span>. При цьому усвідомлюю ризики, які можуть скластися у зв\'язку з воєнним станом введеним Указом Президента України № 64/2022 від  24 лютого 2022 року.         </p>         <br>         <p>           <b>Я підтверджую</b>, що на момент надання мені доступу до користування Простором:           <ul>             <li>у мене відсутні будь-які ознаки ГРВІ, а саме: підвищена температура тіла (більше 37,2 С), кашель, утруднене дихання тощо;</li>             <li>я ознайомлений(а) з рекомендаціями МОЗ та ВООЗ щодо попередження зараження COVID-19 та їх дотримуюсь;</li>             <li>протягом останніх 7 днів я не перебував(ла) за межами України та протягом останніх 7 днів не контактував(ла) з особами, щодо яких наявна підозра/хворими на COVID-19.</li>           </ul>         </p>         <br>         <p>           <b>Я зобов’язуюсь</b> під час користування Простором дотримуватися посилених санітарно-гігієнічних норм, а також рекомендацій МОЗ та ВООЗ щодо запобігання поширенню COVID-19, а саме:           <ul>             <li>носити медичну маску/респіратор;</li>             <li>ретельно мити руки з милом протягом 20-40 сек. та регулярно обробляти їх антисептичним засобом під час перебування в Просторі;</li>             <li>дотримуватися дистанції min 1,5 (півтора) метри від інших відвідувачів Простору.</li>           </ul>         </p> <p><b>Я розумію</b>, що при оголошенні повітряної тривоги необхідно негайно покинути приміщення Простору та зайняти місце у захисній споруді (сховищі, підвальному приміщенні), а також дотримуватися рекомендацій та правил органів державної влади та місцевого самоврядування.</p>       </div><br>       <div>         <b>Дата</b>: ' + todayGlobal + '       </div>')
  documentTextContent.hidden = true
  documentTextWrapper.appendChild(documentTextHeader)
  documentTextWrapper.appendChild(documentTextContent)
  target.parentNode.appendChild(documentTextWrapper)
  return documentTextContent
}

function createAdditionalOfficeSelectors(ids, datalist){
  var list = []
  ids.forEach((id, index) => {
    const newID = "additional_office_" + (index+1)
    const selector = replaceInputWithDropdown(id, datalist, newID)
    selector.parentNode.style.display = "none"
    if (index > 0) selector.parentNode.childNodes.item("LABEL").style.display = "none"
    list.push(selector)
  })
  return list
}

function calcDateLimits(thisWeek){
  const nowDate = new Date()
  var limits = []
  if (thisWeek) {
    const dateMin = nowDate.toISOString().split("T")[0]
    const nowWeekDay = nowDate.getDay()
    const daysToAdd = !nowWeekDay ? 0 : 7 - nowWeekDay
    nowDate.setDate(nowDate.getDate() + daysToAdd)
    const dateMax = nowDate.toISOString().split("T")[0]
    limits.push(dateMin)
    limits.push(dateMax)
  } else {
    const nowWeekDay = nowDate.getDay()
    const daysToAdd = !nowWeekDay ? 1 : 7 - nowWeekDay + 1
    nowDate.setDate(nowDate.getDate() + daysToAdd)
    const dateMin = nowDate.toISOString().split("T")[0]
    nowDate.setDate(nowDate.getDate() + 6)
    const dateMax = nowDate.toISOString().split("T")[0]
    limits.push(dateMin)
    limits.push(dateMax)
  }
  return limits
}

function reverseForFS(date){
  if (!date) return null
  const vals = date.split("-")
  return vals[2]+"-"+vals[1]+"-"+vals[0]
}

function getElemList(idList){
  var collection = []
  idList.forEach(id => {
    collection.push(document.getElementById(id))
  })
  return collection
}

function createCapacityDisplay(nextElement){
  const wrapper = document.createElement("div")
  wrapper.style.border = "3px solid #70c9e9"
  wrapper.style.minHeight = "100px"
  wrapper.style.width = "250px"
  wrapper.style.margin = "5px 0px 5px 0px"
  wrapper.style.padding = "5px"
  const mainWrapper = nextElement.parentNode
  mainWrapper.insertBefore(wrapper, nextElement)
  wrapper.hidden = true
  return wrapper
}

function createCovidQuestions(){
  //const [covidWrapper1,covidDropdown1] = createCovidDropdown("covid_dropdown1", "Have you been abroad during the last 7 days?")
  const [covidWrapper2,covidDropdown2] = createCovidDropdown("covid_dropdown2", "Have you contacted with any suspected/COVID-19 patients for the last 5 days?")
  const [covidWrapper3,covidDropdown3] = createCovidDropdown("covid_dropdown3", "Do you have any symptoms of cold (high temperature, etc.)?")
  const covidDropdownMessage = document.createElement("div")
  covidDropdownMessage.innerHTML = "Sorry, you are not allowed to visit the office."
  covidDropdownMessage.style.color = "red"
  covidDropdownMessage.hidden = true
  const mainWrapper = document.createElement("div")
  //mainWrapper.appendChild(covidWrapper1)
  mainWrapper.appendChild(covidWrapper2)
  mainWrapper.appendChild(covidWrapper3)
  mainWrapper.appendChild(covidDropdownMessage)
  const covidDropdownList = [covidDropdown2,covidDropdown3]
  return [mainWrapper, covidDropdownList, covidDropdownMessage]

  function createCovidDropdown(id, text){
    const wrapper = document.createElement("div")
    const covidDropdown = document.createElement("select")
    covidDropdown.id = id
    const optionNull = document.createElement("option")
    optionNull.innerHTML = "..."
    const optionYes = document.createElement("option")
    optionYes.innerHTML = "Yes"
    const optionNo = document.createElement("option")
    optionNo.innerHTML = "No"
    covidDropdown.appendChild(optionNull)
    covidDropdown.appendChild(optionYes)
    covidDropdown.appendChild(optionNo)
    const covidDropdownHeader = document.createElement("label")
    covidDropdownHeader.htmlFor = id
    covidDropdownHeader.innerHTML = text
    covidDropdownHeader.style.marginTop = "10px"
    covidDropdownHeader.style.marginRight = "50px"
    wrapper.appendChild(covidDropdownHeader)
    wrapper.appendChild(covidDropdown)
    return [wrapper,covidDropdown]
  }
}

function collectCapacityLocations(){
  const officeLocations = officeCapacity
  for (let parking in parkingSettings) {
    if (parkingSettings[parking].hasCapacity) officeLocations.push(parking)
  }
  return officeLocations
}

function checkBrowser(){
  var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && window['safari'].pushNotification));
  return isSafari
}

function getWeekStarts(){
    const today = new Date()
    var thisWeek, nextWeek
    thisDay = today.getDay()
    if (thisDay === 0) thisDay = 7
    thisWeek = new Date()
    thisWeek.setHours(thisWeek.getHours() - (thisDay - 1)*24)
    nextWeek = new Date()
    nextWeek.setHours(nextWeek.getHours() + (7 - thisDay + 1)*24)
    return [
      thisWeek.toISOString().split("T")[0],
      nextWeek.toISOString().split("T")[0]
    ]
}
