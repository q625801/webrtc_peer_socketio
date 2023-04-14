<template>
  <div class="wrap">
    <div class="webrtc-all">
      <div class="video-content">
        <div class="localVideo-wrap">
          <video ref="localVideo" class="localVideo" v-show="myVideoFlag"></video>
          <video ref="clickVideo" class="localVideo clickVideo" v-show="!myVideoFlag"></video>
          <div class="video-btn">
            <el-button class="prev" v-show="!myVideoFlag" @click="showMyVideo()">显示自己</el-button>
            <el-button class="prev" @click="recordHandler">{{recordFlag ? '结束录制':'开始录制'}}</el-button>
            <el-button class="prev" @click="getScreen" v-show="screenFlag">屏幕共享</el-button>
            <!-- <el-button class="prev" @click="endVideo">结束会议</el-button> -->
          </div>
        </div>
        <div class="remoteVideo-wrap">
          <div class="scroll">
            <div ref="remoteVideo"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import "@/utils/peer.js"
import "@/utils/ReplaceableMediaStream"
import { io } from "@/utils/socket.io.js";
import { ref,reactive,toRefs,onDeactivated, onMounted, onUnmounted } from "vue";
import { useRouter,useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import config from "../utils/config";
const route = useRoute()
const router = useRouter()
const localVideo = ref(null)
const remoteVideo = ref(null)
const clickVideo = ref(null)
const buflen = 2048
const state = reactive({
  localStream: '',//用于切换当前媒体流数据 //摄像头/屏幕分享
  peer:'',
  userId:'',
  socket:'',
  peerCallList:[],
  //视频录制
  recordFlag:false,
  mediaRecorder:'',
  chunks:[],
  //音频录制
  audioTime:null,
  analyser:null,
  audioRecord:false,
  mediaStreamSource:null,
  buf:new Float32Array( buflen ),
  rafID:null,
  audioRecorder:'',
  audioChunks:[],
  //
  remoteInfo:{},
  myVideoFlag:true,
  screenFlag:true,
  onVideo:null,
})

const tempStream = new MediaStream();
let audioContext = '';
onMounted(() => {
    setTimeout(() => {
        localVideo.value.srcObject = tempStream.remoteStream;
        localVideo.value.autoplay = true;
        localVideo.value.style.height = '100%'
        // localVideo.value.play();
        getUserMedia({video: true, audio: true}, function(stream) {
            stream.replaceVideoTrack(stream.getVideoTracks()[0])
            stream.replaceAudioTrack(stream.getAudioTracks()[0])
            state.localStream = stream
            getLocalStream();

            // 录制音频
            // audioContext = new AudioContext()
            // state.mediaStreamSource = audioContext.createMediaStreamSource(stream);
            // state.analyser = audioContext.createAnalyser();
            // state.analyser.fftSize = 2048;
            // state.mediaStreamSource.connect( state.analyser );
            // state.audioRecorder = new MediaRecorder(stream);
            // state.audioRecorder.ondataavailable = function (e) {
            //   console.log("Added audio");
            //   state.audioChunks.push(e.data);
            // }
            // state.audioRecorder.onstop = audioStop;
            // updatePitch();
        }, function(err) {
            console.log('Failed to get local stream' ,err);
            ElMessage({
              type: "error",
              message: "获取摄像头/麦克风设备信息失败！",
            });
        });
    },500)
})

onUnmounted(() => {
    window.cancelAnimationFrame(state.rafID)
    clearTimeout(state.audioTime)
		state.audioTime = null
    
    if(state.peer){
        state.peer.destroy()
        state.localStream.getTracks()[0].stop()
        state.localStream.getTracks()[1].stop()
        state.socket.emit('leave','')
        state.peer = ''
    }
    
})

function initSocket(UserId) {//获取到用户输入的id并传到服务端
    console.log(UserId,'UserId')
    state.socket = io(`${config.PROTOCOL}://${config.socketIP}:${config.socketPORT}`)
    state.socket.open();
    state.socket.emit('join',{UserId:UserId,roomId:route.query.roomid})

    state.socket.on('joined',(data) => { //其他用户加入房间
      //创建p2p链接
      console.log('joined:',data)
      createP2P(data.otherUserId)
    })
    state.socket.on('leave', (data) => {
        console.log('leave:',data)
        document.getElementById(data.otherUserId).remove();
        //删除对于call数据
        state.peerCallList.splice(state.peerCallList.findIndex(item => item.peer == data.otherUserId),1)
        console.log(state.peerCallList)
    }); //连接断开
}

let getLocalStream = () => {
  state.peer = new Peer('',{
    host: config.socketIP,
    port: config.socketPORT,
    path: "/peerjs/myapp",
    // config: {'iceServers': [
    //   { url: 'stun:47.98.144.20:3478' }, //stun:stun.l.google.com:19302
    //   { url: 'turn:47.98.144.20:3478', credential: '',username: "" }
    // ]} /* Sample servers, please use appropriate ones */
  })
  state.peer.on('open', function(id) {
    // $("#myPeerid").val(id);
    state.userId = id
    initSocket(id);
    console.log(id,'myid======>')
  });
  state.peer.on("connection", (conn) => {
    console.log(conn,'connon')
    conn.on("data", (data) => {
      // Will print 'hi!'
      console.log(data);
    });
    conn.on("open", () => {
      conn.send("hello!");
    });
  });
  state.peer.on('call', function(call) {
    console.log(call,'===============call')
    state.peerCallList.push(call); //peer.js连接成功后 peerConnection.getSenders()[0].replaceTrack 通过此方法修改远程数据流 因此需要保存所有已连接的用户call对象 后续离开房间还需删除
    call.answer(state.localStream);
    call.once('stream', function(remoteStream) {
      // console.log(remoteStream);
      // remoteVideo.value.srcObject = remoteStream;
      // remoteVideo.value.autoplay = true;
      console.log(remoteStream,'getLocalStream')
      createRemoteVideo(remoteStream,call.peer) //创建连接此房间的其他用户video
    });
    call.on('close', function() {
      console.log("call close");
    });
  });
}

let getUserMedia = (constrains,success,error) => {
  try {
    if(navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia(constrains).then(success).catch(error);
    } else if (navigator.webkitGetUserMedia){
      navigator.webkitGetUserMedia(constrains).then(success).catch(error);
    } else if (navigator.mozGetUserMedia){
      navagator.mozGetUserMedia(constrains).then(success).catch(error);
    } else if (navigator.getUserMedia){
      navigator.getUserMedia(constrains).then(success).catch(error);
    }
  } catch (error) {
    console.log(error)
    ElMessage({
      type: "error",
      message: "获取摄像头/麦克风设备信息失败！",
    });
  }
}
let getScreen = async () => {
    console.log(state.peerCallList)
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    console.log('Received local screen stream');
    changeRemoteStream(stream)
    stream.replaceVideoTrack(stream.getVideoTracks()[0])
    state.screenFlag = false
    //结束屏幕共享
    stream.getVideoTracks()[0].onended = async ()=>{
        getUserMedia({video: true, audio: false}, function(localstream) {
            changeRemoteStream(localstream) //修改远程视频流
            localstream.replaceVideoTrack(localstream.getVideoTracks()[0]) //修改本地视频流
            state.screenFlag = true
        }, function(err) {
            console.log('Failed to get local stream' ,err);
        });
    }
}
let changeRemoteStream = (stream) => {
    if(state.peerCallList.length == 0){
      return
    }
    state.peerCallList.forEach(item => {
        let SendersArr = item.peerConnection.getSenders()
        SendersArr.forEach(key => {
          if(key.track.kind == "video"){
            key.replaceTrack(stream.getVideoTracks()[0])
          }
        })
        // item.peerConnection.getSenders()[0].replaceTrack(stream.getVideoTracks()[0])
    })
}
let recordHandler = () => {
    if(state.recordFlag){
        stopRecord()
    }else{
        startRecord()
    }
    state.recordFlag = !state.recordFlag
}
let startRecord = () => {
    state.mediaRecorder = new MediaRecorder(localVideo.value.captureStream());
    state.mediaRecorder.ondataavailable = function (e) {
        console.log("Added Data");
        state.chunks.push(e.data);
    }
    state.mediaRecorder.onstop = onStop;
    state.mediaRecorder.start();
}
let stopRecord = async () => {
    state.mediaRecorder.stop();
}
let onStop = (e) => {
    console.log("data available after MediaRecorder.stop() called.");
    var blob = new Blob(state.chunks, {
        type: 'video/webm'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = 'test.webm';
    a.click();
    window.URL.revokeObjectURL(url);
    state.chunks = [];
}
let createP2P = (remoteId) => {
  console.log(remoteId,state.localStream)
  var call = state.peer.call(remoteId,state.localStream);
  state.peerCallList.push(call); //peer.js连接成功后 peerConnection.getSenders()[0].replaceTrack 通过此方法修改远程数据流 因此需要保存所有已连接的用户call对象 后续离开房间还需删除
  const conn = state.peer.connect(remoteId);
  console.log(conn)
  conn.on("open", () => {
    conn.send("hi!");
  });
  conn.on("data", (data) => {
    // Will print 'hello!'
    console.log(data);
  });
  call.once('stream', function(remoteStream) {
    console.log(remoteStream,'createP2P')
    // remoteVideo.value.srcObject = remoteStream;
    // remoteVideo.value.autoplay = true;
    createRemoteVideo(remoteStream,remoteId)
  });
  call.on('close', function() {
    console.log("call close");
    conn.close();
  });
  call.on('error', function(err) {
    console.log(err);
  });
}
let createRemoteVideo = (remoteStream,remoteId) => {
    console.log(remoteStream,remoteId,'remoteStream,remoteId=====>')
    state.remoteInfo[remoteId] = remoteStream
    let video = document.createElement("video");
    video.srcObject = remoteStream;
    video.autoplay = true; 
    video.muted = true;
    video.playsinline = true;
    video.id = remoteId
    video.style.width = "100%"
    video.onclick = () => {
      changeShowVide(video,remoteStream)
    }
    remoteVideo.value.appendChild(video);
}
//改变主视频显示逻辑
let changeShowVide = (video,remoteStream) => {
  if(state.onVideo){
    state.onVideo.style.borderWidth = 0
  }

  clickVideo.value.srcObject = remoteStream
  clickVideo.value.autoplay = true; 
  clickVideo.value.muted = true;
  clickVideo.value.playsinline = true;
  clickVideo.value.style.height = "100%"
  clickVideo.value.style["max-width"] = "100%"
  video.style.border = "4px solid red"
  video.style.boxSizing = "border-box"
  state.myVideoFlag = false
  state.onVideo = video
}

let showMyVideo = () => {
  state.myVideoFlag = true
  state.onVideo.style.borderWidth = 0
}
//录制音频逻辑
function autoCorrelate( buf, sampleRate ) {
	// Implements the ACF2+ algorithm
	var SIZE = buf.length;
	var rms = 0;

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var r1=0, r2=SIZE-1, thres=0.2;
	for (var i=0; i<SIZE/2; i++)
		if (Math.abs(buf[i])<thres) { r1=i; break; }
	for (var i=1; i<SIZE/2; i++)
		if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

	buf = buf.slice(r1,r2);
	SIZE = buf.length;

	var c = new Array(SIZE).fill(0);
	for (var i=0; i<SIZE; i++)
		for (var j=0; j<SIZE-i; j++)
			c[i] = c[i] + buf[j]*buf[j+i];

	var d=0; while (c[d]>c[d+1]) d++;
	var maxval=-1, maxpos=-1;
	for (var i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	var T0 = maxpos;

	var x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	var a = (x1 + x3 - 2*x2)/2;
	var b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}
function updatePitch( time ) {
	state.analyser.getFloatTimeDomainData( state.buf );
	var ac = autoCorrelate( state.buf, audioContext.sampleRate );

 	if (ac == -1) {
    console.log("没有说话")
 	} else {
    console.log("正在说话")
    if(!state.audioRecord){
      console.log("开启录音")
      state.audioRecord = true
      state.audioRecorder.start()
    }
    clearTimeout(state.audioTime)
		state.audioTime = null
		state.audioTime = setTimeout(() => {
      console.log("结束录音")
			state.audioRecord = false
      state.audioRecorder.stop()
      return
		},1000)
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	state.rafID = window.requestAnimationFrame( updatePitch );
}
let audioStop = () => {
  const blob = new Blob(state.audioChunks, { type: 'audio/ogg; codecs=opus' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'audio.ogg';
  link.click();
  state.audioChunks = [];
  console.log(state.audioChunks)
}

let endVideo = () => {
  router.go(-1)
}
const {recordFlag,myVideoFlag,screenFlag} = {...toRefs(state)}
</script>

<style lang="less" scoped>
.wrap {
  width: 100%;
  height: 100%;
  .webrtc-all{
    height: 100%;
    .video-content{
      height: 100%;
      overflow: hidden;
      .localVideo-wrap{
        width: 80%;
        height: 100%;
        text-align: center;
        float: left;
        position: relative;
        .localVideo{
          height: 100%;
          max-width: 100%;
          max-height: 100%;
        }
        .video-btn{
          width: 100%;
          position: absolute;
          bottom: 20px;
          left: 0;
        }
      }
      .remoteVideo-wrap{
        float: left;
        width: 20%;
        height: 100%;
        overflow: hidden;
        position: relative;
        .scroll{
          overflow-y: scroll;
          height: 100%;
          position: absolute;
          width: 100%;
        }
      }
    }
    
  }
}

</style>
