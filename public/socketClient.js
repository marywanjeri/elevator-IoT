var socket;
///Client variables being sent to ESP32 WebsocketServer
var groundFloorButtonHasBeenTapped=0;
var firstFloorButtonHasBeenTapped=0;
var secondFloorButtonHasBeenTapped=0;
var stopButtonHasBeenTapped=0;
var saveNewWifi=0;
var wiFiUSSDForESPToConnectTo = "";
var wiFiPassword = "";
var toggleToOnlineMode=0;
var refreshCurrentStats=0;
///Client variables being sent to Cloud Socket-IO Server
var toggleToOfflineMode=0;
var webpageID = "WEBPAGE";
///Local variables
var socketIsConnected = false;
var stopButtonName = "Stop";
var groundButtonName = "Ground";
var floor1ButtonName = "Floor_1";
var floor2ButtonName = "Floor_2";
///SocketIO events being sent to server
var acknowledgeDeviceResponseEvent= 'acknowledgeDeviceResponse';
var clientInfoUpdateEvent= 'clientInfoUpdate';
///SocketIO events being received from server
var acknowledgeDeviceRequestEvent= 'acknowledgeDeviceRequest';
var elevatorInfoUpdateEvent = 'elevatorInfoUpdate';
var connectedToESP32Event = 'connectedToESP32';



function initClientSocket() {
    if(usesPlainWebsockets){///use WebSocket
        socket = new WebSocket('ws://' + window.location.hostname + ':81/');
        // socket = new WebSocket('ws://' + '192.168.4.1' + ':81/');
        socket.onmessage = function(event) {
            processElevatorInfoData(event.data);
        };
        socket.addEventListener('open',function (_) {
            socketIsConnected = true;
            updateSocketConnectionUI();
        });
        socket.addEventListener('close',function (_) {
            socketIsConnected = false;
            updateSocketConnectionUI();
        });
    }else{///Use SocketIO
        initSocketIOClient();
    }

    // changeViewsAccordingToCurrentMode();
    // setInterval(()=>{
    //     // var x = Math.floor(Math.random()*1000);
    //     var x = Math.floor(Math.random()*(10000000-0));
    //     document.getElementById('rand1').innerHTML = x;
    // },2000);
}




function initSocketIOClient() {
    socket = io();///Server serves webpage so no need for inserting ipAddress
    // socket = io.connect('178.79.158.51:3002',{transports: ['websocket']}); 
    // socket = io.connect('localhost'+':'+'5005',{transports: ['websocket']});///Socket-IO client and Websockets server connection works; 
    // socket = io.connect('https://elevator-iot-server.herokuapp.com',{transports: ['websocket']});///Keeps Connecting and disconnecting 
    // socket = io('ws://' + window.location.hostname + ':81/',{transports: ['websocket']});///Keeps Connecting and disconnecting 
    socket.on('connect', function(_) {
        socketIsConnected = true;
        console.log('Connected to server');
        updateSocketConnectionUI();
    });
    socket.on('disconnect', function(_) {
        socketIsConnected = false;
        updateSocketConnectionUI();
    });
    socket.on(acknowledgeDeviceRequestEvent, function(_) {
        emitSingleVariableToSocketIOServer(acknowledgeDeviceResponseEvent,webpageID);
    });
    socket.on(elevatorInfoUpdateEvent, function(data) {
        processElevatorInfoData(data);
    });
    socket.on(connectedToESP32Event, function(data) {
        document.getElementById('connectedToESP32_value').innerHTML = (data == "1") ? 'true' : 'false';
    });
}

function updateSocketConnectionUI(){
    if(usesPlainWebsockets){
        document.getElementById('connectedToESP32_value').innerHTML = socketIsConnected ? 'true' : 'false';
    }else{
        document.getElementById('socketConnected_value').innerHTML = socketIsConnected ? 'true' : 'false';
    }
}

function processElevatorInfoData(jsonData) {
    // console.log('ReceivedData: '+jsonData);
    try {
        var obj = usesPlainWebsockets ? JSON.parse(jsonData) : jsonData;
        // console.log('Received message from server:' +obj);
        setCurrentAnimationFrame(obj.currentFloor, obj.desiredFloor, obj.currentFrameFraction, obj.direction,obj.floor1ToFloor2Ratio);
        document.getElementById('currentFloor_value').innerHTML = obj.currentFloor;
        document.getElementById('motion_value').innerHTML = obj.motion;
        document.getElementById('direction_value').innerHTML = obj.direction;
        document.getElementById('angularVelocity_value').innerHTML = obj.angularVelocity;
        document.getElementById('frameFraction_value').innerHTML = obj.currentFrameFraction;
        // document.getElementById('linearVelocity_value').innerHTML = obj.linearVelocity;
        // document.getElementById('rand1').innerHTML = obj.linearVelocity;
        document.getElementById('rand1').innerHTML = obj.desiredFloor;
        var cantConnectToNewWifi = obj.cantConnectToNewWifi;
        if(cantConnectToNewWifi != null && cantConnectToNewWifi ==1)
        document.getElementById("warning").innerHTML= "Connection Failed";
    } catch (error) {
        console.log('ERROR Parsing JsonData: '+error);
    }
}
 
function ground_FloorButton_Tapped(){
    if(!canInteractWithModel) return;
    if(animationControlMode == 1){
        groundFloorButtonHasBeenTapped =1;
        sendLocalVariablesToServer();
    }else setCurrentAnimation(groundButtonName);
    
    // var x = Math.floor(Math.random()*(1000-0));
    // x = x/1000;
    // console.log(`Random fraction is ${x}`);
    // setCurrentAnimationFrame(x);
}
function first_FloorButton_Tapped(){
    if(!canInteractWithModel) return;
    if(animationControlMode == 1){
        firstFloorButtonHasBeenTapped=1;
        sendLocalVariablesToServer();
    }else setCurrentAnimation(floor1ButtonName);
}
function second_FloorButton_Tapped(){
    if(!canInteractWithModel) return;
    if(animationControlMode == 1){
        secondFloorButtonHasBeenTapped=1;
        sendLocalVariablesToServer();
    }else setCurrentAnimation(floor2ButtonName);
}
function stopButton_Tapped(){
    if(!canInteractWithModel) return;
    if(animationControlMode == 1){
        stopButtonHasBeenTapped=1;
        sendLocalVariablesToServer();
    }else setCurrentAnimation(stopButtonName);
}
function add_New_Wifi_Button_Tapped(){
    saveNewWifi=1;
    sendLocalVariablesToServer();
}
function toggle_OffOnMode_Button_Tapped(){
    if (usesPlainWebsockets) {
       toggleToOnlineMode= 1;
    }else{
       toggleToOfflineMode=1;
    }
    sendLocalVariablesToServer();
}
function requestCurrentStatsRefresh() {
    refreshCurrentStats = 1;
    sendLocalVariablesToServer();
}

function sendLocalVariablesToServer(){
    if(!socketIsConnected){
        reset();
        return;
    }

    var msg = {
        groundFloorButtonHasBeenTapped: groundFloorButtonHasBeenTapped,
        firstFloorButtonHasBeenTapped: firstFloorButtonHasBeenTapped,
        secondFloorButtonHasBeenTapped: secondFloorButtonHasBeenTapped,
        stopButtonHasBeenTapped: stopButtonHasBeenTapped,
        saveNewWifi: saveNewWifi,
        newWiFiUSSD: wiFiUSSDForESPToConnectTo,
        wiFiPassword: wiFiPassword,
        toggleToOnlineMode: toggleToOnlineMode,
        toggleToOfflineMode: toggleToOfflineMode,
        refreshCurrentStats: refreshCurrentStats,
    };

    if(usesPlainWebsockets){
        try {
           socket.send(JSON.stringify(msg)); ///Functionality of Websocket
        } catch (error) {
            console.log('ERROR Sending JsonData to ESP32 Server: '+error);
        }
    }else{
        // var msg = {
        //     groundFloorButtonHasBeenTapped: groundFloorButtonHasBeenTapped,
        //     firstFloorButtonHasBeenTapped: firstFloorButtonHasBeenTapped,
        //     secondFloorButtonHasBeenTapped: secondFloorButtonHasBeenTapped,
        //     stopButtonHasBeenTapped: stopButtonHasBeenTapped,
        //     refreshCurrentStats: refreshCurrentStats,
        //     ///No much need for variables below coz client is already connected to Esp32 
        //     // saveNewWifi: saveNewWifi,
        //     // newWiFiUSSD: wiFiUSSDForESPToConnectTo,
        //     // wiFiPassword: wiFiPassword,
        // };
        try {
            socket.emit(clientInfoUpdateEvent, JSON.stringify(msg));
        } catch (error) {
            console.log('ERROR Sending JsonData to Cloud Server: '+error);
        }
    }
      
    reset();
}

function emitSingleVariableToSocketIOServer(eventName,data) {
    if(socketIsConnected){
        socket.emit(eventName, data);
    }
}

function reset() {
    groundFloorButtonHasBeenTapped=0;
    firstFloorButtonHasBeenTapped=0;
    secondFloorButtonHasBeenTapped=0;
    stopButtonHasBeenTapped=0;
    saveNewWifi = 0;
    wiFiUSSDForESPToConnectTo = "";
    wiFiPassword = "";
    toggleToOnlineMode=0;
    toggleToOfflineMode=0;
    refreshCurrentStats = 0;
}


function myFunction(){
    
    document.querySelector(".popup").style.display="flex";
    document.querySelector(".popup").style.display="none";
    var un = document.forms["myForm"]["Uname"].value;
    var pw = document.forms["myForm"]["Pass"].value;
    saveNewWifi = 1;
    wiFiUSSDForESPToConnectTo = un;
    wiFiPassword = pw;
    sendLocalVariablesToServer();
    // if(un=="NodeMcu" && pw=="1234") document.getElementById("mode").innerHTML= "ONLINE MODE"; 
    // else document.getElementById("incorrect").innerHTML= "Incorrect Username or Password!";
}
function addWiFiFunction(){
    document.querySelector(".popup").style.display="flex";
    if(document.getElementById("mode").innerHTML=="ONLINE MODE"){
        document.getElementById("warning").innerHTML= "Aready in Online Mode";
    }
    
}
function closePopup(){
    document.querySelector(".popup").style.display="none";
}
function confirmIfShldToggleOffOnlineMode(){
    var result = confirm("Are You sure?");
    if (result==true){
        if(usesPlainWebsockets) {
            toggleToOnlineMode = 1;
            window.open("https://elevator-iot-server.herokuapp.com", "_blank"); //_blank is for opening given link in a new  tab
        }
        else toggleToOfflineMode = 1;
        sendLocalVariablesToServer();
        // document.getElementById("mode").innerHTML= "ALERT WORKING";
    }
    else{
        event.preventDefault();
    }
}

///NOTE:
///SocketIO connecting options is path n transport eg. {path: '/path/to/socket.io', transports: ['websocket']}
///path default is /socket.io/
///socket-io-client refused to connect to linode server(probably needed to connect to a http/s address.Not an Ip address)