const socket = io();

const front = document.querySelector("#front");
const frontForm = front.querySelector("form");

const room = document.querySelector("#room");
const myStream = room.querySelector("#myStream");
const myFace = myStream.querySelector("#myFace");
const micBtn = myStream.querySelector("#mic");
const cameraBtn = myStream.querySelector("#camera");
const camerasSelect = myStream.querySelector("#cameras");
const peersFace = myStream.querySelector("#peersFace");

room.hidden = true;

let myVideo;
let micMuted = false;
let cameraMuted = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getDevices() {
    try { 
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myVideo.getVideoTracks();
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if (camera.label === currentCamera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    } catch (e) {
        console.log(e);
    }
}

async function getMedia(cameraId) {
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" }
    }
    const newConstraints = {
        audio: true,
        video: { deviceId: { exact: cameraId } }
    }
    try { 
        myVideo = await navigator.mediaDevices.getUserMedia(
            cameraId ? newConstraints : initialConstraints
        );
        myFace.srcObject = myVideo;
        if (!cameraId) {
            await getDevices();
        }
    } catch (e) {
        console.log(e);
    }
}

async function initCall() {
    front.hidden = true;
    room.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleFrontSubmit(event) {
    event.preventDefault();
    const input = frontForm.querySelector("input");
    await initCall();
    socket.emit("join", input.value);
    roomName = input.value;
    input.value = "";
}

function handleMicClick() {
    if (!micMuted) {
        micBtn.innerText = "MIC ON";
        micMuted = true;
    } else {
        micBtn.innerText = "MIC OFF";
        micMuted = false;
    }
    myVideo.getAudioTracks().forEach(track => track.enabled = !micMuted);
}

function handleCameraClick() {
    if (!cameraMuted) {
        cameraBtn.innerText = "CAMERA ON";
        cameraMuted = true;
    } else {
        cameraBtn.innerText = "CAMERA OFF";
        cameraMuted = false;
    }
    myVideo.getVideoTracks().forEach(track => track.enabled = !cameraMuted);
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
    myVideo.getAudioTracks().forEach(track => track.enabled = !micMuted);
    myVideo.getVideoTracks().forEach(track => track.enabled = !cameraMuted);
    if (myPeerConnection) {
        const videoTrack = myVideo.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

frontForm.addEventListener("submit", handleFrontSubmit);

micBtn.addEventListener("click", handleMicClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);


// Socket Code

socket.on("join", async () => {
    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", console.log);
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
    myPeerConnection.addEventListener("datachannel", (event) => {
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", console.log);
    });
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
});

socket.on("answer", answer => {
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
    myPeerConnection.addIceCandidate(ice);
});

// RTC Code

function handleIce(data) {
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
    peersFace.srcObject = data.stream;
}

function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302"
                ]
            }
        ]
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myVideo.getTracks().forEach(track => myPeerConnection.addTrack(track, myVideo));
}
