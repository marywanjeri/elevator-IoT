// const elevatorModelTag = document.querySelector("#elevatorModelTag");
var currentFloor = 0;
var animationIsPlaying = false;
var windowAnimationFrameID;
var totalAnimationFrames; ///in ms
var isGoingUp = true;//elevator is going up
var elevatorMotionIsInReverse = false;//elevator is going up
var elevatorIsAtASpecificFloor = true;
var desiredFloor = 0;
///DIGITAL TWIN CONTROL
var previouslyReceievedFrameFraction = 0; //esp32 will send a value of 0 if at groundfloor
var initializedElevatorPosition = false;
var initializedElevatorPositionInterval;
var playFunctionAlreadyCalled = false; //used if .pause() is not called

var floor0UpFrame = 0;
// var floor0UpFrame = 600;
var floor1UpFrame = 990;
var floor2Frame = 2600;
var floor1DownFrame= 4385;
var floor0DownFrame = 5416; ///total animation duration is 5416.666507720947
// var floor0DownFrame = 5385; ///total animation duration is 5416.666507720947
var newAnimationCycleDiff = 4500; //how to know we are in a new animation cycle
var elevatorModelTimeAfterMotion = floor0UpFrame; ///in ms; used to control the frame of the elevator animation displayed,updated after movement to each floor

function initializeObjectModel() {
    // elevatorModelTag.orientation = "0deg -90deg 0deg";///roll(Z),pitch(X),yaw(Y),,if set after loadd event, add function updateFraming()
    elevatorModelTag.addEventListener("load",e => {
        console.log("Object Loaded");
        console.log("Its animations are ");
        for(var animation in elevatorModelTag.availableAnimations){
            console.log(animation);
        }
        if(elevatorModelTag.availableAnimations.length>0) elevatorModelTag.animationName = "0";
        // elevatorModelTimeAfterMotion = floor0UpFrame;
        setTimeout(()=>{
            elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000; ///only works after a delay after load event
        },20)
        canInteractWithModel = true;

    });
    elevatorModelTag.addEventListener("finished",e => {//when animation is done
        animationIsPlaying = false;
        console.log("Finished playing animation ");
    });
}

function changeAnimationControlMode(){
    // playFunctionAlreadyCalled = false;
    if(animationControlMode == 0) animationControlMode = 1;
    else if(animationControlMode == 1) animationControlMode = 0;
    if(animationControlMode==0) {
        // document.getElementById("simulateButton").style.color = "green";
        document.getElementById("simulateButton").textContent = "Digital Twin Mode";
        console.log("Now in Simulation Mode");
    }
    else {
        document.getElementById("simulateButton").textContent = "Simulate";
        console.log("Now in Digital Twin Mode");
        requestCurrentElevatorPosition();
        initializedElevatorPosition = false;
        initializedElevatorPositionInterval = null;
    }
    stopAnimation();
    elevatorModelTimeAfterMotion = floor0UpFrame;///the frame cld be past floor2
    elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;
    elevatorMotionIsInReverse = false;//elevator is going up
}

///-----------------------------DIGITAL TWIN CONTROL-----------------------------------------------------------------------------------------------------
function setCurrentAnimationFrame(receivedCurrentFloor, receivedDesiredFloor, receivedCurrentFrameFraction, direction, receivedFloor0To1Fraction) {
    //receivedCurrentFrameFraction is a fraction (current mvt/total mvt) of the physical model motion
    // debugLog(`---Received CurrentFrameFraction:${receivedCurrentFrameFraction}`);
    var initializingElevatorPosition = !initializedElevatorPosition; //used by child function
    if(!initializedElevatorPosition) {///first place digital elevator at the same position as physical elevator
        initializedElevatorPosition = true;
        if(!initializedElevatorPositionInterval)
            initializedElevatorPositionInterval = setInterval(()=>{
                if(canInteractWithModel){
                    initializedElevatorPosition = false;
                    setCurrentAnimationFrame(receivedCurrentFloor, receivedDesiredFloor, receivedCurrentFrameFraction, direction);
                    clearInterval(initializedElevatorPositionInterval);
                }else debugLog(`Waiting until model is loaded`);
            },100);//100 ms
        if(!canInteractWithModel) return;
    }
    else if(!canInteractWithModel || animationControlMode == 0 || animationIsPlaying|| //where .pause function is not called,animationIsPlaying is false when desired floor has been reached
            previouslyReceievedFrameFraction == receivedCurrentFrameFraction) {
        // debugLog(`CanInteractWithModel:${canInteractWithModel} - AnimationControlModel:${animationControlMode} - 
            // AnimationControlModel:${animationIsPlaying} - previouslyReceievedFrameFraction is equal to  receivedCurrentFrameFraction ${previouslyReceievedFrameFraction == receivedCurrentFrameFraction}`);
        return;
    }
    previouslyReceievedFrameFraction =receivedCurrentFrameFraction; ///if stop button is received, the last currentframe is the one that will be stopped at 
    debugLog(" ");
    // debugLog(`Received from ESP32. CurrentFloor:${receivedCurrentFloor},DesiredFloor:${receivedDesiredFloor},
    // CurrentFrameFraction:${receivedCurrentFrameFraction},Direction:${direction},`);
    debugLog(`Received CurrentFrameFraction:${receivedCurrentFrameFraction}`);

    var floor1DownFraction = (floor1UpFrame-floor0UpFrame)/floor2Frame;
    var floor2DownFraction = (floor2Frame-floor0UpFrame)/floor2Frame;
    var floor1UpFraction = (floor2Frame-floor1UpFrame)/floor2Frame;
    var currentFrameFraction;

    if(receivedCurrentFloor==0)  {
        currentFrameFraction = floor0UpFrame/floor2Frame;
        if(receivedDesiredFloor == 0){
            if(direction == "Up") { debugLog("ERROR: Direction cannot be upwards"); return;}
            else if(direction == "Down") currentFrameFraction += ((1.0-receivedCurrentFrameFraction)*floor1DownFraction);//get remaining time to return back to bottom
            ///else if Stationary, no change
            debugLog(`CurrentFrameFraction floor 0-0 :${currentFrameFraction}`);
        } 
        else if(receivedDesiredFloor == 1){
            if(direction == "Down") { debugLog("ERROR: Direction cannot be downwards"); return;}
            else if(direction == "Up") currentFrameFraction += (receivedCurrentFrameFraction*floor1DownFraction);///relative position physical model is 
            ///else if Stationary, no change
            debugLog(`CurrentFrameFraction floor 0-1 :${currentFrameFraction}`);
        }
        else if(receivedDesiredFloor == 2){
            if(direction == "Down") { debugLog("ERROR: Direction cannot be downwards"); return;}
            else if(direction == "Up") {
                ///Calculations involved example
                //These fractions are ones from esp32: let a = from0To2Fraction(1.0),, let b = from0To1Fraction(1.0),, let x = receivedFraction
                ///If x = a, find y(actual fraction from floor0 to 2) ;  y =(xb)/a
                var actualFractionFromFloor0To2 = receivedFloor0To1Fraction;
                // debugLog(`Case0: receivedCurrentFrameFraction : ${receivedCurrentFrameFraction},,receivedFloor0To1Fraction : ${receivedFloor0To1Fraction}`);
                if(receivedCurrentFrameFraction<=receivedFloor0To1Fraction){
                    actualFractionFromFloor0To2= receivedCurrentFrameFraction/receivedFloor0To1Fraction;//actual fraction 
                    currentFrameFraction += (actualFractionFromFloor0To2*floor1DownFraction);///relative position physical model is 
                    // debugLog(`Case1: ActualFractionFromFloor0To2 : ${actualFractionFromFloor0To2}`);
                }
                else if(receivedCurrentFrameFraction>receivedFloor0To1Fraction){
                    actualFractionFromFloor0To2= (receivedCurrentFrameFraction - receivedFloor0To1Fraction)/(1.0-receivedFloor0To1Fraction);
                    currentFrameFraction += ((floor1UpFrame/floor2Frame) +(actualFractionFromFloor0To2*floor1UpFraction));///relative position physical model is 
                    // debugLog(`Case2: ActualFractionFromFloor0To2 : ${actualFractionFromFloor0To2}`);
                }
                // currentFrameFraction += (receivedCurrentFrameFraction*floor2DownFraction);
            }
            ///else if Stationary, no change
            debugLog(`CurrentFrameFraction floor 0-2 :${currentFrameFraction}`);
        }
    }
    else if(receivedCurrentFloor==1)  {
        currentFrameFraction = floor1UpFrame/floor2Frame;
        if(receivedDesiredFloor == 0){
            if(direction == "Up") { debugLog("ERROR: Direction cannot be upwards"); return;}
            else if(direction == "Down") currentFrameFraction -= (receivedCurrentFrameFraction*floor1DownFraction);///relative position physical model is 
            debugLog(`CurrentFrameFraction floor 1-0 :${currentFrameFraction}`);
        }
        else if(receivedDesiredFloor == 1){
            if(direction == "Up") currentFrameFraction -= ((1.0-receivedCurrentFrameFraction)*floor1DownFraction);//get remaining time to return back to floor1
            else if(direction == "Down")currentFrameFraction += ((1.0-receivedCurrentFrameFraction)*floor1UpFraction);//get remaining time to return back to floor1
            debugLog(`CurrentFrameFraction floor 1-1 :${currentFrameFraction}`);
        }
        else if(receivedDesiredFloor == 2){
            if(direction == "Down") { debugLog("ERROR: Direction cannot be downwards"); return;}
            else if(direction == "Up") currentFrameFraction += (receivedCurrentFrameFraction*floor1UpFraction);///relative position physical model is 
            debugLog(`CurrentFrameFraction floor 1-2 :${currentFrameFraction}`);
        }
    }
    else if(receivedCurrentFloor==2) {;
        currentFrameFraction = floor2Frame/floor2Frame;
        // currentFrameFraction = 1.0;
        if(receivedDesiredFloor == 2){
            if(direction == "Down") { debugLog("ERROR: Direction cannot be downwards"); return;}
            else if(direction == "Up") currentFrameFraction -= ((1.0-receivedCurrentFrameFraction)*floor1UpFraction);//get remaining time to return back to top
            debugLog(`CurrentFrameFraction floor 2-0 :${currentFrameFraction}`);
        } 
        else if(receivedDesiredFloor == 1){
            if(direction == "Up") { debugLog("ERROR: Direction cannot be upwards"); return;}
            else if(direction == "Down") currentFrameFraction -= (receivedCurrentFrameFraction*floor1UpFraction);///relative position physical model is 
            debugLog(`CurrentFrameFraction floor 2-1 :${currentFrameFraction}`);
        }
        else if(receivedDesiredFloor == 0){
            if(direction == "Up") { debugLog("ERROR: Direction cannot be upwards"); return;}
            else if(direction == "Down") {
                var actualFractionFromFloor2To1 = 1.0- receivedFloor0To1Fraction;
                var actualFractionFromFloor2To0 = actualFractionFromFloor2To1;
                // debugLog(`Case0: receivedCurrentFrameFraction : ${receivedCurrentFrameFraction},,actualFractionFromFloor2To1 : ${actualFractionFromFloor2To1}`);
                if(receivedCurrentFrameFraction<=actualFractionFromFloor2To1){
                    actualFractionFromFloor2To0= receivedCurrentFrameFraction/actualFractionFromFloor2To1;//actual fraction 
                    currentFrameFraction -= (actualFractionFromFloor2To0*floor1UpFraction);///relative position physical model is 
                    // debugLog(`Case1: ActualFractionFromFloor2To0 : ${actualFractionFromFloor2To0}`);
                }
                else if(receivedCurrentFrameFraction>actualFractionFromFloor2To1){
                    actualFractionFromFloor2To0= (receivedCurrentFrameFraction - actualFractionFromFloor2To1)/(1.0-actualFractionFromFloor2To1);
                    currentFrameFraction -= ((1.0-(floor1UpFrame/floor2Frame)) +(actualFractionFromFloor2To0*floor1DownFraction));///relative position physical model is 
                    // debugLog(`Case2: ActualFractionFromFloor2To0 : ${actualFractionFromFloor2To0}`);
                }
                // currentFrameFraction -= (receivedCurrentFrameFraction*floor2DownFraction);
            }
            debugLog(`CurrentFrameFraction floor 2-2 :${currentFrameFraction}`);
        }
    } 
    if(currentFrameFraction == null) { debugLog("ERROR: currentFrameFraction is null"); return;}
    if(currentFrameFraction<0) { debugLog("ERROR: currentFrameFraction cannot be negative"); return;}
    debugLog(`Manipulated CurrentFrameFraction is :${currentFrameFraction}`);

    // digitalTwin(currentFrameFraction,direction,initializingElevatorPosition);
    digitalTwinUpdated(currentFrameFraction,direction,initializingElevatorPosition);
}


function totalFramesToBeWorkedWith(){
    return floor2Frame-floor0UpFrame; //In this case, we are working with the first part of the animation
}

//In this case of digital twin, requested AnimationFrame is cancelled after animation was complete
function digitalTwin(currentFrameFraction,direction,initializingElevatorPosition){
    var receivedCurrentFrame = floor0UpFrame + (currentFrameFraction*totalFramesToBeWorkedWith());
    debugLog(`Received Animation Frame is ${receivedCurrentFrame}`);
    debugLog(`Local ModelViewerTime variable is ${elevatorModelTimeAfterMotion}`);
    debugLog(`Direction is ${direction}`);
    var start;
    var initialElevatorModelTime = elevatorModelTimeAfterMotion; 
    var previousModelCurrentTime;///used to know uf animation moves into the next animation cycle 
    elevatorMotionIsInReverse = elevatorModelTimeAfterMotion> receivedCurrentFrame;

    var startMotion = false;
    if(direction == "Up" && (receivedCurrentFrame>elevatorModelTimeAfterMotion)) startMotion = true;
    else if(direction == "Down" && (elevatorModelTimeAfterMotion>receivedCurrentFrame)) startMotion = true; 
    
    if(startMotion || initializingElevatorPosition){
        elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;///reason of this is that when animation is paused, it doesnt save its last frame;there shld be no delay between this line and .play()
        // elevatorModelTag.play(); //animationIsPlaying will be false as from first condition
        animationIsPlaying = true;
        elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;///reason of this is that when animation is paused, it doesnt save its last frame;there shld be no delay between this line and .play()
        if(elevatorMotionIsInReverse) debugLog(`Elevator Motion Is In Reverse`);
        windowAnimationFrameID = window.requestAnimationFrame(step);
    }else{
        debugLog(`Already at required frame`);
    } 

    function step(timeStamp){
        if(!start) {
            start = timeStamp;
            // elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;///reason of this is that when animation is paused, it doesnt save its last frame;there shld be no delay between this line and .play()
            // elevatorModelTag.play(); //animationIsPlaying will be false as from first condition
            // animationIsPlaying = true;
            // elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;///reason of this is that when animation is paused, it doesnt save its last frame;there shld be no delay between this line and .play()
        }
        var progress = Math.abs(timeStamp-start);
        function elevatorModelCurrentTime(){ return elevatorModelTag.currentTime*1000;}
        var reachedLimit = false; //To prevent requesting for another animation frame when animation is done
        var differenceBetweenWindowFrames;///when an animation cycle repeats get elevatorModelCurrentTime cld go from 36ms to 5406ms or 5350ms to 40ms 
        if(previousModelCurrentTime) differenceBetweenWindowFrames = Math.abs(elevatorModelCurrentTime() -previousModelCurrentTime);
        previousModelCurrentTime = elevatorModelCurrentTime(); 

        function pauseMotion() {
            window.cancelAnimationFrame(windowAnimationFrameID);
            if (!elevatorMotionIsInReverse)
                debugLog(`(N)Animation Done. Elevator CurrentTime: ${elevatorModelCurrentTime()} `);
            else debugLog(`(R)Animation Done. Elevator CurrentTime: ${elevatorModelCurrentTime()} `);
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
            pauseElevatorAnimation();
            reachedLimit = true;
        }

        debugLog(`Elevator CurrentTime: ${elevatorModelCurrentTime()}`);
        // debugLog(`Received Time: ${receivedCurrentFrame}`);
        if(!elevatorMotionIsInReverse){
            elevatorModelTag.currentTime = (initialElevatorModelTime + progress)/1000;
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
            debugLog(`Setting CurrentTime to: ${initialElevatorModelTime + progress}`);
            debugLog(`CurrentTime is now: ${elevatorModelCurrentTime()}`);
            if(elevatorModelCurrentTime() >= receivedCurrentFrame) pauseMotion();
        }
        else{
            elevatorModelTag.currentTime = (initialElevatorModelTime - progress)/1000;
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
            debugLog(`Setting CurrentTime to: ${elevatorModelCurrentTime()}`);
            if(elevatorModelCurrentTime() <= receivedCurrentFrame) pauseMotion();
            else if(differenceBetweenWindowFrames && differenceBetweenWindowFrames>newAnimationCycleDiff){ ///if not null and frames zimeachana sana(New animation cycle started)
                pauseMotion();
                elevatorModelTimeAfterMotion = floor0UpFrame;
                elevatorModelTag.currentTime = floor0UpFrame/1000; ///change in frame wont be visible
            }
        }

        if(!reachedLimit) {
            windowAnimationFrameID = window.requestAnimationFrame(step);
        }
    }

}

var cancelAnimationFrameOnDone = true;
//In this case of digital twin, the function will act as a game update function, position will be updated in every frame. 
//requested AnimationFrame will not be cancelled
function digitalTwinUpdated(currentFrameFraction,direction,initializingElevatorPosition){
    var receivedCurrentFrame = floor0UpFrame + (currentFrameFraction*totalFramesToBeWorkedWith());
    // receivedCurrentFrameGlobal = receivedCurrentFrame;
    // receivedDirectionGlobal = direction;
    debugLog(`Received Animation Frame is ${receivedCurrentFrame}`);
    debugLog(`Local ModelViewerTime variable is ${elevatorModelTimeAfterMotion}`);
    debugLog(`Direction is ${direction}`);
 
    function _canMoveElevator() {
        var startMotion = false;
        if(direction == "Up" && (receivedCurrentFrame>elevatorModelTimeAfterMotion)) startMotion = true;
        else if(direction == "Down" && (elevatorModelTimeAfterMotion>receivedCurrentFrame)) startMotion = true; 
        return startMotion;
    }
    elevatorMotionIsInReverse = elevatorModelTimeAfterMotion> receivedCurrentFrame;

    var previousDt;
    var dt;
    var previousModelCurrentTime;///used to know if animation moves into the next animation cycle 
    if(_canMoveElevator() || initializingElevatorPosition){
        elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;
        animationIsPlaying = true;
        // elevatorModelTag.timeScale = -1.0; ///was meant to go reverse but .play() is not called,so wint work

        if(!cancelAnimationFrameOnDone){
            if(!playFunctionAlreadyCalled) {
                windowAnimationFrameID = window.requestAnimationFrame(step);
                playFunctionAlreadyCalled = true;
            }
        }else windowAnimationFrameID = window.requestAnimationFrame(step);
    }else{
        debugLog(`Already at required frame`);
    } 

    function step(timeStamp){
        if(!previousDt) previousDt = timeStamp;
        dt = timeStamp-previousDt;
        previousDt = timeStamp;
        function elevatorModelCurrentTime(){ return elevatorModelTag.currentTime*1000;}
        var reachedLimit = false; //To prevent requesting for another animation frame when animation is done
        var differenceBetweenWindowFrames;///when an animation cycle repeats get elevatorModelCurrentTime cld go from 36ms to 5406ms or 5350ms to 40ms 
        if(previousModelCurrentTime) differenceBetweenWindowFrames = Math.abs(elevatorModelCurrentTime() -previousModelCurrentTime);
        previousModelCurrentTime = elevatorModelCurrentTime(); 

        function stepMvtCompleted() {
            if (!elevatorMotionIsInReverse)
                debugLog(`(N)Animation Done. Elevator CurrentTime: ${elevatorModelCurrentTime()} `);
            else debugLog(`(R)Animation Done. Elevator CurrentTime: ${elevatorModelCurrentTime()} `);
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
            animationIsPlaying = false;
            if(cancelAnimationFrameOnDone){
                window.cancelAnimationFrame(windowAnimationFrameID);
                reachedLimit = true;
            }
        }

        if(animationIsPlaying){
            // debugLog(`Elevator CurrentTime: ${elevatorModelCurrentTime()}`);
            if(!elevatorMotionIsInReverse){
                // debugLog(`Going up`);
                elevatorModelTimeAfterMotion +=dt;
                elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;
                ///when .play() function is called, after a period of time it moves much faster than the frame-rate speed.So function below was for control
                // if(elevatorModelCurrentTime() <elevatorModelTimeAfterMotion){
                //     elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;
                //     debugLog(`Setting CurrentTime to: ${elevatorModelTimeAfterMotion}`);
                // }else {
                //     elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
                //     debugLog(`CurrentTime had already sped up to: ${elevatorModelCurrentTime()}`);
                // }
                // if(elevatorModelCurrentTime() >= receivedCurrentFrameGlobal) logStepMvtCompleted();
                if(elevatorModelCurrentTime() >= receivedCurrentFrame) stepMvtCompleted();
            }
            else{
                // debugLog(`Going down`);
                elevatorModelTimeAfterMotion -=dt;
                elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;
                // debugLog(`Setting CurrentTime to: ${elevatorModelCurrentTime()}`);
                if(elevatorModelCurrentTime() <= receivedCurrentFrame) stepMvtCompleted();
                else if(differenceBetweenWindowFrames && differenceBetweenWindowFrames>newAnimationCycleDiff){ ///if not null and frames zimeachana sana(New animation cycle started)
                    stepMvtCompleted();
                    elevatorModelTimeAfterMotion = floor0UpFrame;
                    elevatorModelTag.currentTime = floor0UpFrame/1000; ///change in frame wont be visible
                }
            }
        }else{
            elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;
            // debugLog(`Reached required frame`);
        }

        if(!reachedLimit) {
            windowAnimationFrameID = window.requestAnimationFrame(step);
        }
    }

}


///-----------------------------SIMULATION------------------------------------------------------------------
function setCurrentAnimation(buttonTapped) {
    debugLog('Button tapped: '+buttonTapped);
    if(!canInteractWithModel || animationControlMode == 1) return;
    if(buttonTapped ==stopButtonName) { 
        stopAnimation();
        return;
    }

    var timeLimit = animationsTimeLimits(buttonTapped);
    if(timeLimit == null) {
        console.log("Elevator is at the desired floor");
        return;
    }
    stopAnimation();

    var animationWasPlayingOnButtonPressed = animationIsPlaying;
    // if(!animationWasPlayingOnButtonPressed) elevatorModelTag.play();
    animationIsPlaying = true;
    elevatorIsAtASpecificFloor = false;
    pauseAnimationOnDone(animationWasPlayingOnButtonPressed);
    // elevatorModelTag.play({repititions:1, pingpong:true});///repeat an animation once then go to next animation,animation doesnt play backwards and forwards
}
function pauseAnimationOnDone(animationWasPlayingOnButtonPressed){
    if(!totalAnimationFrames) totalAnimationFrames = elevatorModelTag.duration*1000; ///duration can only be got after .play method has been called
    if(!animationWasPlayingOnButtonPressed) {
        elevatorModelTag.currentTime = elevatorModelTimeAfterMotion/1000;///reason of this is that when animation is paused, it doesnt save its last frame;there shld be no delay between this line and .play()
        debugLog(`Setting Animation start time to ${elevatorModelTag.currentTime*1000 }`);
    }
    if(elevatorMotionIsInReverse) debugLog(`Animation direction is in reverse`);

    var start;
    var initialElevatorModelTime = elevatorModelTimeAfterMotion;
    var previousModelCurrentTime;///used to know uf animation moves into the next animation cycle 

    function step(timeStamp){
        if(!start) start = timeStamp;
        var progress = timeStamp-start;
        function elevatorModelCurrentTime(){ return elevatorModelTag.currentTime*1000;}
        var reachedLimit = false;//To prevent requesting for another animation frame when animation is done
        var differenceBetweenWindowFrames;///when an animation cycle repeats get elevatorModelCurrentTime cld go from 36ms to 5406ms or 5350ms to 40ms 
        if(previousModelCurrentTime) differenceBetweenWindowFrames = Math.abs(elevatorModelCurrentTime() -previousModelCurrentTime);
        previousModelCurrentTime = elevatorModelCurrentTime(); 

        function pauseMotion(state) {
            window.cancelAnimationFrame(windowAnimationFrameID);
            debugLog(`Animation Done. Elevator CurrentTime: ${elevatorModelCurrentTime()} `);
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
            pauseElevatorAnimation();
            if(state==0) debugLog(`NR:Reached floor1 from floor0`); //NR-Non-reverse  R-reverse
            else if(state==1) debugLog(`N:Reached floor1 from floor2`);
            else if(state==2) debugLog(`N:Reached floor2`);
            else if(state==3) debugLog(`N:Reached floor0 and Animation has been restarted`);
            else if(state==4) debugLog(`N:Reached floor0`);
            else if(state==5) debugLog(`R:Reached floor1 from floor0`); //N-Non-reverse  R-reverse
            else if(state==6) debugLog(`R:Reached floor1 from floor2`);
            else if(state==7) debugLog(`R:Reached floor2`);
            else if(state==8) debugLog(`R:Reached floor0 and Animation has been restarted`);
            else if(state==9) debugLog(`R:Reached floor0`);
            reachedLimit = true;
        }

        debugLog(`Elevator CurrentTime: ${elevatorModelCurrentTime()}`);
        if(!elevatorMotionIsInReverse){
            elevatorModelTag.currentTime = (initialElevatorModelTime + progress)/1000;
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();

            if(desiredFloor == 1){
                if(isGoingUp){ ///from ground floor
                    if(elevatorModelCurrentTime() >= floor1UpFrame) pauseMotion(0);
                }else{///from 2nd floor
                    if(elevatorModelCurrentTime() >= floor1DownFrame) pauseMotion(1);
                }
            }
            else if(desiredFloor == 2){
                if(elevatorModelCurrentTime() >= floor2Frame) pauseMotion(2);
            }
            else if(desiredFloor == 0){
                if(elevatorModelCurrentTime() >= floor0DownFrame) pauseMotion(4);
                else if(differenceBetweenWindowFrames && differenceBetweenWindowFrames>newAnimationCycleDiff){ ///if not null and frames zimeachana sana(New animation cycle started)
                    pauseMotion(3);
                    elevatorModelTimeAfterMotion = floor0DownFrame;
                    elevatorModelTag.currentTime = floor0DownFrame/1000; ///change in frame wont be visible
                    isGoingUp = true;
                    elevatorMotionIsInReverse = true;
                }
            }
        }else{//NOTE: In reverse mode, the required time is set but on the next frame you will see that the current time is higher as modelViewer only plays forwards
            elevatorModelTag.currentTime = (initialElevatorModelTime - progress)/1000;
            elevatorModelTimeAfterMotion = elevatorModelCurrentTime();
            // debugLog(`TT:Setting CurrentTime to: ${elevatorModelCurrentTime()}`);
            if(desiredFloor == 1){
                if(isGoingUp){ ///from ground floor
                    if(elevatorModelCurrentTime() <= floor1DownFrame) pauseMotion(5);
                }else{///from 2nd floor
                    if(elevatorModelCurrentTime() <= floor1UpFrame) pauseMotion(6);
                }
            }
            else if(desiredFloor == 2){
                if(elevatorModelCurrentTime() <= floor2Frame) pauseMotion(7);
            }
            else if(desiredFloor == 0){
                if(elevatorModelCurrentTime() <= floor0UpFrame) pauseMotion(9);
                else if(differenceBetweenWindowFrames && differenceBetweenWindowFrames>newAnimationCycleDiff){ ///if not null and frames zimeachana sana(New animation cycle started)
                    pauseMotion(8);
                    elevatorModelTimeAfterMotion = floor0UpFrame;
                    elevatorModelTag.currentTime = floor0UpFrame/1000; ///change in frame wont be visible
                    isGoingUp = true;
                    elevatorMotionIsInReverse = false;
                }
            }
        }
        if(!reachedLimit) {
            windowAnimationFrameID = window.requestAnimationFrame(step);
        }
    }
    windowAnimationFrameID = window.requestAnimationFrame(step);
}


function animationsTimeLimits(buttonTapped){
    var timeLimit;
    if(buttonTapped == groundButtonName){
        timeLimit = _moveToGroundFloor();
    }
    else if(buttonTapped == floor1ButtonName){
        timeLimit = _moveToFirstFloor();
    }    
    else if(buttonTapped == floor2ButtonName){
        timeLimit = _moveToSecondFloor();
    }

    return timeLimit;
}

function isAtSpecifiedFloor(floor){
    ///maximum frame that elevator cld have stopped at when made to stop at first floor(wont stop at exactly e.g floor1DownFrameInFraction )
    var midFloorFraction0_1 = (floor1UpFrame-floor0UpFrame)/2;
    var midFloorFraction1_2 = floor1UpFrame + ((floor2Frame-floor1UpFrame)/2);
    var midFloorFraction2_1 = floor2Frame+((floor1DownFrame-floor2Frame)/2);
    var midFloorFraction1_0 = floor1DownFrame + ((floor0DownFrame-floor1DownFrame)/2);

    if(floor==0){
         return elevatorIsAtASpecificFloor && 
        (elevatorModelTimeAfterMotion < midFloorFraction0_1 || elevatorModelTimeAfterMotion > midFloorFraction1_0);}
    else if(floor==1) {
        ///For better accuracy, more code is needed but for now, this works
        return elevatorIsAtASpecificFloor && 
        (elevatorModelTimeAfterMotion>= midFloorFraction0_1 && elevatorModelTimeAfterMotion<= midFloorFraction1_2) ||
        (elevatorModelTimeAfterMotion>= midFloorFraction2_1 && elevatorModelTimeAfterMotion<= midFloorFraction1_0);
    }else{//floor==2
        return elevatorIsAtASpecificFloor && 
        (elevatorModelTimeAfterMotion > midFloorFraction1_2 && elevatorModelTimeAfterMotion < midFloorFraction2_1);
    }
}


function _moveToGroundFloor(){
    var timeLimit;
    if(isAtSpecifiedFloor(0) || elevatorModelTimeAfterMotion == floor0UpFrame 
        ||elevatorModelTimeAfterMotion == floor0DownFrame) return timeLimit;

    if(elevatorModelTimeAfterMotion<floor2Frame){
        timeLimit = floor0UpFrame;
        elevatorMotionIsInReverse = true;
        isGoingUp = false;
    }
    else if(elevatorModelTimeAfterMotion>= floor2Frame){ ///follow the animation flow if they are equal
        timeLimit = floor0DownFrame;
        elevatorMotionIsInReverse = false;
        isGoingUp = false;
    }
    desiredFloor = 0;
    return timeLimit;
}

function _moveToSecondFloor(){
    var timeLimit;
    if(isAtSpecifiedFloor(2) || elevatorModelTimeAfterMotion == floor2Frame) return timeLimit;
    
    timeLimit = floor2Frame;
    if(elevatorModelTimeAfterMotion<floor2Frame){
        elevatorMotionIsInReverse = false;
        isGoingUp = true;
        console.log("Lower side of floor2");
    }
    else if(elevatorModelTimeAfterMotion> floor2Frame){
        elevatorMotionIsInReverse = true;
        isGoingUp = true;
        console.log("Upper side of floor1");
    }

    desiredFloor = 2;
    return timeLimit;
}

function _moveToFirstFloor(){
    var timeLimit;
    if(isAtSpecifiedFloor(1) || elevatorModelTimeAfterMotion==floor1UpFrame || 
        elevatorModelTimeAfterMotion==floor1DownFrame) return timeLimit;

    if(elevatorModelTimeAfterMotion<floor2Frame){
        if(elevatorModelTimeAfterMotion<floor1UpFrame){
            timeLimit = floor1UpFrame;
            elevatorMotionIsInReverse = false;
            isGoingUp = true;
        }
        else if(elevatorModelTimeAfterMotion>floor1UpFrame){
            timeLimit = floor1UpFrame;
            elevatorMotionIsInReverse = true;
            isGoingUp = false;
        }
    }
    else if(elevatorModelTimeAfterMotion>= floor2Frame){ ///follow the animation flow if they are equal
        if(elevatorModelTimeAfterMotion<floor1DownFrame){
            timeLimit = floor1DownFrame;
            elevatorMotionIsInReverse = false;
            isGoingUp = false;
        }
        else if(elevatorModelTimeAfterMotion>floor1DownFrame){
            timeLimit = floor1DownFrame;
            elevatorMotionIsInReverse = true;
            isGoingUp = true;
        }
    }
    desiredFloor = 1;
    return timeLimit;
}


///-----------------------------BOTH DIGITAL TWIN CONTROL AND SIMULATION-----------------------------------------
function pauseElevatorAnimation(stoppingAnimationOnCommand =false){
    // elevatorModelTag.pause();  ///NOTE: This will also reset the current frame
    animationIsPlaying = false;
    if(!stoppingAnimationOnCommand){//if one clicks stop button everything is executed excepted instruction inside this block
        elevatorIsAtASpecificFloor = true;
        console.log("Paused Animation");
    } 
}

function stopAnimation() {
    if(animationIsPlaying && windowAnimationFrameID != null) {
        window.cancelAnimationFrame(windowAnimationFrameID);
        elevatorModelTimeAfterMotion = elevatorModelTag.currentTime*1000;///called before pause;before it is reset
        pauseElevatorAnimation(true);
        console.log(`Stopping Animation at ${elevatorModelTimeAfterMotion} `);
    }
}

function debugLog(inputLog) {
    return;
    console.log(inputLog);
}

///BELOW IS AN IDEA THAT WAS NEVER USED
///trying to find how to approximately find the current floor elevator is at to be able to know how to set elevatorMotionIsInReverse and isGoingUp when a floor button is tapped
///tapping code shld cater for the same floor
function findApproximatedCurrentFloor(){
    var floor = 0;

    ///result is the previous floor b4 it advances to the next . Imagine the elevator being in motion
    if(!elevatorMotionIsInReverse){ ///following animation frames flow
        if(elevatorModelTimeAfterMotion<floor1UpFrame) floor=0; ///between midFloorFraction0_1 and floor1UpFrame
        else{
            if(elevatorModelTimeAfterMotion<floor2Frame) floor=1;
            else{
                if(elevatorModelTimeAfterMotion<floor1DownFrame) floor=2;
                else{
                    if(elevatorModelTimeAfterMotion>=floor0DownFrame) floor=0; ///Remember it is just an approximation
                    else floor = 1;
                }
            }
        }
    }else{///elevatorMotionIsInReverse = true
        if(elevatorModelTimeAfterMotion>floor1DownFrame) floor=0; 
        else{
            if(elevatorModelTimeAfterMotion>floor2Frame) floor=1;
            else{
                if(elevatorModelTimeAfterMotion>floor1UpFrame) floor=2;
                else{
                    if(elevatorModelTimeAfterMotion<=floor0UpFrame) floor=0; ///Remember it is just an approximation
                    else floor = 1;
                }
            } 
        }
    }
}
function logAnimationNameToPlay(animationIndex){
    var logString = "Ground_to_Floor1_Animation";
    if(animationIndex == 1)logString = "Floor1_to_Floor2_Animation";
    else if(animationIndex == 2)logString = "Floor2_to_Floor1_Animation";
    else if(animationIndex == 3)logString = "Floor1_to_Ground_Animation";
    else if(animationIndex == 4)logString = "Ground_to_Floor2_Animation";
    else if(animationIndex == 5)logString = "Floor2_to_Ground_Animation";
    console.log('Setting animation: '+logString);
}


///Playing multiple animations didnt work bcoz cross-fade of animations didnt work as expected.
// Animation had to repeat >=2 times before changing to the next animation and setting cross-fade to 1ms jerked the animation
///Mistake made: 
    //Had set elevatorModelTag.currentTime to a variable.Also 
    //elevatorModelTag.play() should not be called as it will autoplay and cause bugs in visuals.Therefore there is no pausing of animation

///Difference b2n simulation and digital twin is that in simulation, buttons sets the elevator position but in digital twin, ESP32 sets the elevator position