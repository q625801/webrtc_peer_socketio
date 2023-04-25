<template>
  <div class="wrap">
    <div class="webrtc-all">
      <!-- <el-button class="prev" @click="recordHandler">{{recordFlag ? '结束录制':'开始录制'}}</el-button> -->
      <roomUser ref="roomUsercmp" :userList="userRoomList" />
      <div class="videolabor-wrap">
        <div class="video-content">
          <div :class="['localVideo-wrap', cameraFlag ? '' : 'cameraoff', mikeFlag ? '' : 'mikeoff']">
            <video ref="localVideo" class="localVideo" v-show="myVideoFlag"></video>
            <video ref="clickVideo" class="localVideo clickVideo" v-show="!myVideoFlag"></video>
            <div class="thumbnail">
              {{ userName }}
            </div>
            <div class="crticuser"></div>
          </div>
          <div :class="['remoteVideo-wrap', peerCallList.length > 5 ? 'rowtow' : '']">
            <div class="scroll">
              <div class="remoteVideo" ref="remoteVideo"></div>
            </div>
          </div>
        </div>
        <div class="labor-content">
          <el-button class="prev" v-show="!myVideoFlag" @click="showMyVideo()">显示自己</el-button>
          <el-button class="displayMedia" @click="getScreen" v-show="screenFlag">屏幕共享</el-button>
          <el-button :class="['changecamera', cameraFlag ? '' : 'cameraoff']" @click="changeCamerOrMike('video')">摄像头</el-button>
          <el-button :class="['changemike', mikeFlag ? '' : 'mikeoff']" @click="changeCamerOrMike('audio')">麦克风</el-button>
          <el-button class="endVideocs" @click="endVideo">结束会议</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import "@/utils/peer.js"
import "@/utils/ReplaceableMediaStream"
import { io } from "@/utils/socket.io.js";
import { ref, reactive, toRefs, onActivated, onDeactivated,onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import config from "../utils/config";
import roomUser from "@/components/roomUser.vue";
const route = useRoute();
const router = useRouter();
const localVideo = ref(null);
const remoteVideo = ref(null);
const clickVideo = ref(null);
const roomUsercmp = ref(null);
const buflen = 2048;
const state = reactive({
  localStream: "", //用于切换当前媒体流数据 //摄像头/屏幕分享
  peer: "",
  peerId: "",
  socket: "",
  peerCallList: [],
  //视频录制
  recordFlag: false,
  mediaRecorder: "",
  chunks: [],
  //音频录制
  audioTime: null,
  analyser: null,
  audioRecord: false,
  mediaStreamSource: null,
  buf: new Float32Array(buflen),
  rafID: null,
  audioRecorder: "",
  audioChunks: [],
  //
  remoteInfo: {},
  myVideoFlag: true,
  screenFlag: true,
  onVideo: null,
  cameraFlag: true,
  mikeFlag: true,

  meetingboardDialogVisible: false,
  userName: route.query.userName,
  userRoomList: [],
});

const tempStream = new MediaStream();
let audioContext = "";
onMounted(() => {
  if(!route.query.roomid){
    ElMessage.error("url参数roomid获取失败，请在url上加上roomid参数")
  }
  if(!route.query.userName){
    ElMessage.error("url参数userName获取失败，请在url上加上userName参数")
  }
  setTimeout(() => {
    localVideo.value.srcObject = tempStream.remoteStream;
    localVideo.value.autoplay = true;
    localVideo.value.style.height = "100%";
    // localVideo.value.play();
    getUserMedia(
      { video: true, audio: true },
      function (stream) {
        stream.replaceVideoTrack(stream.getVideoTracks()[0]);
        stream.replaceAudioTrack(stream.getAudioTracks()[0]);
        state.localStream = stream;
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
        
      },
      function (err) {
        console.log("Failed to get local stream", err);
        ElMessage({
          type: "error",
          message: "获取摄像头/麦克风设备信息失败！",
        });
      },
    );
  }, 500);
});

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

function initSocket(peerId) {
  //获取到用户输入的id并传到服务端
  console.log(peerId, "peerId");
  state.socket = io(`${config.PROTOCOL}://${config.socketIP}:${config.socketPORT}`);
  state.socket.open();
  state.socket.emit("join", { peerId: peerId, roomId: route.query.roomid, userInfo: { userId: route.query.userId, userName: state.userName, video: true, mike: true } });
  state.socket.on("joined", data => {
    //其他用户加入房间
    //创建p2p链接
    console.log("joined:", data);
    createP2P(data.otherpeerId);
  });
  state.socket.on("leave", data => {
    //连接断开
    console.log("leave:", data);
    document.getElementById(data.otherpeerId).remove(); //删除video标签
    //删除对于call数据
    deleteArrIndex(state.peerCallList, data, "peer", "otherpeerId");
    // console.log(state.peerCallList, state.userRoomList);
  });
  state.socket.on("cameramike", data => {
    //接收其他用户点击摄像头或麦克风按钮操作
    let trcbox = document.getElementById(data.otherpeerId);
    console.log(data);
    if (data.data.type == "video") {
      data.data.flag ? trcbox.classList.remove("cameraoff") : trcbox.classList.add("cameraoff");
    } else {
      data.data.flag ? trcbox.classList.remove("mikeoff") : trcbox.classList.add("mikeoff");
    }
  });
  state.socket.on("setUserList", data => {
    state.userRoomList = data;
    console.log(state.userRoomList, "addstate.userRoomList ==============>");
  });
  function deleteArrIndex(arr, data, arrkey, datakey) {
    if (arr.length > 0) {
      arr.splice(
        arr.findIndex(item => item[arrkey] == data[datakey]),
        1,
      );
    }
  }
}

let getLocalStream = () => {
  // state.peer = new Peer('',{
  //   host: "localhost",
  //   port: 9000,
  //   path: "/peerjs/myapp",
  // });
  state.peer = new Peer("", {
    host: config.socketIP,
    port: config.socketPORT,
    path: "/peerjs/myapp",
    config: {
      iceServers: [
        { url: "stun:stun.l.google.com:19302" },
        {
          url: "turn:47.98.144.20:3478",
          credential: "li123",
          username: "li",
        },
      ],
    },
  });
  state.peer.on("open", function (id) {
    // $("#myPeerid").val(id);
    state.peerId = id;
    initSocket(id);
    console.log(id, "myid======>");
  });
  state.peer.on("connection", conn => {
    console.log(conn, "connon");
    conn.on("data", data => {
      // Will print 'hi!'
      console.log(data);
    });
    conn.on("open", () => {
      conn.send("hello!");
    });
  });
  state.peer.on("call", function (call) {
    console.log(call, "===============call");
    state.peerCallList.push(call); //peer.js连接成功后 peerConnection.getSenders()[0].replaceTrack 通过此方法修改远程数据流 因此需要保存所有已连接的用户call对象 后续离开房间还需删除
    call.answer(state.localStream);
    call.once("stream", function (remoteStream) {
      // console.log(remoteStream);
      // remoteVideo.value.srcObject = remoteStream;
      // remoteVideo.value.autoplay = true;
      console.log(remoteStream, "getLocalStream ===================>");
      createRemoteVideo(remoteStream, call.peer); //创建连接此房间的其他用户video
    });
    call.on("close", function () {
      console.log("call close");
    });
  });
};

let getUserMedia = (constrains, success, error) => {
  try {
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia(constrains).then(success).catch(error);
    } else if (navigator.webkitGetUserMedia) {
      navigator.webkitGetUserMedia(constrains).then(success).catch(error);
    } else if (navigator.mozGetUserMedia) {
      navagator.mozGetUserMedia(constrains).then(success).catch(error);
    } else if (navigator.getUserMedia) {
      navigator.getUserMedia(constrains).then(success).catch(error);
    }
  } catch (error) {
    console.log(error);
    ElMessage({
      type: "error",
      message: "获取摄像头/麦克风设备信息失败！",
    });
  }
};
let getScreen = async () => {
  console.log(state.peerCallList);
  const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  console.log("Received local screen stream");
  changeRemoteStream(stream);
  stream.replaceVideoTrack(stream.getVideoTracks()[0]);
  state.screenFlag = false;
  //结束屏幕共享
  stream.getVideoTracks()[0].onended = async () => {
    getUserMedia(
      { video: true, audio: false },
      function (localstream) {
        changeRemoteStream(localstream); //修改远程视频流
        localstream.replaceVideoTrack(localstream.getVideoTracks()[0]); //修改本地视频流
        state.screenFlag = true;
      },
      function (err) {
        console.log("Failed to get local stream", err);
      },
    );
  };
};
let changeRemoteStream = stream => {
  if (state.peerCallList.length == 0) {
    return;
  }
  state.peerCallList.forEach(item => {
    let SendersArr = item.peerConnection.getSenders();
    SendersArr.forEach(key => {
      if (key.track.kind == "video") {
        key.replaceTrack(stream.getVideoTracks()[0]);
      }
    });
    // item.peerConnection.getSenders()[0].replaceTrack(stream.getVideoTracks()[0])
  });
};
//视频录像
let recordHandler = () => {
  if (state.recordFlag) {
    stopRecord();
  } else {
    startRecord();
  }
  state.recordFlag = !state.recordFlag;
};
let startRecord = () => {
  state.mediaRecorder = new MediaRecorder(localVideo.value.captureStream());
  state.mediaRecorder.ondataavailable = function (e) {
    console.log("Added Data");
    state.chunks.push(e.data);
  };
  state.mediaRecorder.onstop = onStop;
  state.mediaRecorder.start();
};
let stopRecord = async () => {
  state.mediaRecorder.stop();
};
let onStop = e => {
  console.log("data available after MediaRecorder.stop() called.");
  var blob = new Blob(state.chunks, {
    type: "video/webm",
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "test.webm";
  a.click();
  window.URL.revokeObjectURL(url);
  state.chunks = [];
};

//建立P2P并创建远程视频videoDom
let createP2P = remoteId => {
  // console.log(remoteId, state.localStream);
  var call = state.peer.call(remoteId, state.localStream);
  state.peerCallList.push(call); //peer.js连接成功后 peerConnection.getSenders()[0].replaceTrack 通过此方法修改远程数据流 因此需要保存所有已连接的用户call对象 后续离开房间还需删除
  const conn = state.peer.connect(remoteId);
  // console.log(conn);
  conn.on("open", () => {
    conn.send("hi!");
  });
  conn.on("data", data => {
    // Will print 'hello!'
    console.log(data);
  });
  call.once("stream", function (remoteStream) {
    // console.log(remoteStream, "createP2P");
    createRemoteVideo(remoteStream, remoteId);
  });
  call.on("close", function () {
    console.log("call close");
    conn.close();
  });
  call.on("error", function (err) {
    console.log(err);
  });
};
let createRemoteVideo = (remoteStream, remoteId) => {
  console.log(remoteStream, remoteId, "remoteStream,remoteId=====>");
  // console.log(remoteStream.getTracks());
  state.remoteInfo[remoteId] = remoteStream;
  let el = document.createElement("div");
  el.id = remoteId;
  let userel = document.createElement("div");
  userel.className = "thumbnail";
  let remoteUserInfo = state.userRoomList.find(item => item.peerId == remoteId).userInfo;
  userel.innerHTML = remoteUserInfo.userName;
  let className = "";
  className += "crtbox";
  if (!remoteUserInfo.video) {
    className += " cameraoff";
  }
  if (!remoteUserInfo.mike) {
    className += " mikeoff";
  }
  el.className = className;
  console.log(remoteUserInfo, className);
  // userel.innerHTML = state.userRoomList.find(item => remoteId.indexOf(item.userId) > -1).userName;
  let video = document.createElement("video");
  video.className = "crtvideo";
  video.srcObject = remoteStream;
  video.autoplay = true;
  video.muted = true;
  video.playsinline = true;
  video.style.width = "100%";
  video.onclick = () => {
    changeShowVide(video, remoteStream);
  };

  let crtuser = document.createElement("div");
  crtuser.className = "crticuser";
  el.appendChild(video);
  el.appendChild(userel);
  el.appendChild(crtuser);

  // remoteStream.getTracks().forEach(t => {
  //   t.enabled ? "" : t.kind == "video" ? el.classList.add("cameraoff") : el.classList.add("mikeaoff");
  // });
  remoteVideo.value.appendChild(el);
};
//改变主视频显示逻辑
let changeShowVide = (video, remoteStream) => {
  if (state.onVideo) {
    state.onVideo.style.borderWidth = 0;
  }

  clickVideo.value.srcObject = remoteStream;
  clickVideo.value.autoplay = true;
  clickVideo.value.muted = true;
  clickVideo.value.playsinline = true;
  clickVideo.value.style.height = "100%";
  clickVideo.value.style["max-width"] = "100%";
  video.style.border = "4px solid red";
  video.style.boxSizing = "border-box";
  state.myVideoFlag = false;
  state.onVideo = video;
};

let showMyVideo = () => {
  state.myVideoFlag = true;
  state.onVideo.style.borderWidth = 0;
};
//录制音频逻辑
function autoCorrelate(buf, sampleRate) {
  // Implements the ACF2+ algorithm
  var SIZE = buf.length;
  var rms = 0;

  for (var i = 0; i < SIZE; i++) {
    var val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01)
    // not enough signal
    return -1;

  var r1 = 0,
    r2 = SIZE - 1,
    thres = 0.2;
  for (var i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  for (var i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  var c = new Array(SIZE).fill(0);
  for (var i = 0; i < SIZE; i++) for (var j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];

  var d = 0;
  while (c[d] > c[d + 1]) d++;
  var maxval = -1,
    maxpos = -1;
  for (var i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  var T0 = maxpos;

  var x1 = c[T0 - 1],
    x2 = c[T0],
    x3 = c[T0 + 1];
  var a = (x1 + x3 - 2 * x2) / 2;
  var b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}
function updatePitch(time) {
  state.analyser.getFloatTimeDomainData(state.buf);
  var ac = autoCorrelate(state.buf, audioContext.sampleRate);

  if (ac == -1) {
    console.log("没有说话");
  } else {
    console.log("正在说话");
    if (!state.audioRecord) {
      console.log("开启录音");
      state.audioRecord = true;
      state.audioRecorder.start();
    }
    clearTimeout(state.audioTime);
    state.audioTime = null;
    state.audioTime = setTimeout(() => {
      console.log("结束录音");
      state.audioRecord = false;
      state.audioRecorder.stop();
      return;
    }, 1000);
  }

  if (!window.requestAnimationFrame) window.requestAnimationFrame = window.webkitRequestAnimationFrame;
  state.rafID = window.requestAnimationFrame(updatePitch);
}
let audioStop = () => {
  const blob = new Blob(state.audioChunks, { type: "audio/ogg; codecs=opus" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "audio.ogg";
  link.click();
  state.audioChunks = [];
  console.log(state.audioChunks);
};

let endVideo = () => {
  window.cancelAnimationFrame(state.rafID);
  clearTimeout(state.audioTime);
  state.audioTime = null;

  if (state.peer) {
    state.peer.destroy();
    state.localStream.getTracks()[0].stop();
    state.localStream.getTracks()[1].stop();
    // state.socket.emit('leave','')
    state.socket.disconnect();
    state.peer = "";
  }

  ElMessage.error("媒体流  peer-server  socketid 连接已断开")
  ElMessage.error("后续操作.......刷新页面或直接关闭页签或跳转页面")
};
let changeCamerOrMike = type => {
  //摄像头或麦克风开启或关闭并通过socketio发送给房间内其他用户改变css样式
  state.localStream.getTracks().forEach(t => {
    if (t.kind == type) {
      t.enabled = !t.enabled;
      state.socket.emit("cameramike", { type: type, flag: t.enabled });
      // let localVideo = document.querySelector('.localVideo-wrap');
      if (type == "video") {
        state.cameraFlag = t.enabled;
      } else {
        state.mikeFlag = t.enabled;
      }
    }
  });
};
onUnmounted(() => {
  endVideo();
});
const { recordFlag, myVideoFlag, screenFlag, cameraFlag, mikeFlag, meetingboardDialogVisible, peerCallList, userName, userRoomList } = { ...toRefs(state) };
</script>

<style lang="less" scoped>
.wrap {
  width: 100%;
  height: 100%;
  .webrtc-all {
    height: 100%;
    display: flex;
    .videolabor-wrap {
      flex: 1;
      .video-content {
        overflow: hidden;
        display: flex;
        flex: 1;
        box-sizing: border-box;
        padding: 20px 0;
        height: calc(100% - 100px);
        background: #3b3b3b;
        justify-content: space-evenly;
        .localVideo-wrap {
          width: 64%;
          height: 100%;
          text-align: center;
          position: relative;
          background: rgba(255, 255, 255, 0.27);
          .localVideo {
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            display: block;
            margin: 0 auto;
          }
          .video-btn {
            width: 100%;
            position: absolute;
            bottom: 20px;
            left: 0;
          }
          &.cameraoff {
            video {
              opacity: 0;
            }
            .crticuser {
              display: block;
            }
          }
          &.mikeoff {
            .thumbnail {
              background: url("@/assets/img/ic-gbwtmkf.png") 12px center no-repeat;
              background-color: rgba(0, 0, 0, 0.6);
              background-size: 17px 18px;
            }
          }
        }
        .remoteVideo-wrap {
          width: 33%;
          height: 100%;
          overflow: hidden;
          position: relative;
          .remoteVideo {
            overflow: hidden;
          }
          .scroll {
            overflow-y: scroll;
            height: 100%;
            position: absolute;
            width: 100%;
          }
          :deep(.crtbox) {
            margin-bottom: 9px;
            background: rgba(255, 255, 255, 0.27);
            position: relative;
            .crticuser {
              width: 65px;
              height: 65px;
              background-size: 35px 35px;
              background-color: #bfbfbf;
            }
            &:last-child {
              margin-bottom: 0;
            }
            .crtvideo {
              display: block;
            }
            &.mikeoff {
              .thumbnail {
                background: url("@/assets/img/ic-gbwtmkf.png") 12px center no-repeat;
                background-color: rgba(0, 0, 0, 0.6);
                background-size: 17px 18px;
              }
            }
            &.cameraoff {
              video {
                opacity: 0;
              }
              .crticuser {
                display: block;
              }
            }
          }
          &.rowtow {
            //当连接的用户大于5个时变为一排两个左右布局
            .remoteVideo {
              display: flex;
              flex-wrap: wrap;
              justify-content: space-between;
            }
            :deep(.crtbox) {
              width: 49%;
              &:last-child {
                margin-bottom: 9px;
              }
              .thumbnail {
                white-space: nowrap;
                text-overflow: ellipsis;
                overflow: hidden;
                -o-text-overflow: ellipsis;
                width: 100%;
                box-sizing: border-box;
              }
            }
          }
        }
        :deep(.thumbnail) {
          color: #ffffff;
          font-size: 16px;
          height: 40px;
          line-height: 40px;
          padding: 0 14px 0 35px;
          display: inline-block;
          position: absolute;
          left: 0;
          bottom: 0;
          background: url("@/assets/img/ic-wtmkf.png") 12px center no-repeat;
          background-color: rgba(0, 0, 0, 0.6);
          background-size: 13px 18px;
        }
        :deep(.crticuser) {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          margin: auto;
          width: 114px;
          height: 114px;
          background: url("@/assets/img/ic-user.png") center no-repeat;
          background-size: 60px 60px;
          background-color: #aed5e9;
          border-radius: 50%;
        }
      }
      .labor-content {
        height: 100px;
        width: 100%;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        .el-button {
          font-size: 16px;
          color: #2baef2;
          border: 0;
          margin: 0 3%;
          padding-top: 58px;
          &:hover {
            background-color: transparent;
          }
        }
        .displayMedia {
          background: url("@/assets/img/ic-pmgx.png") center top no-repeat;
          background-size: 48px 42px;
        }
        .endVideocs {
          background: url("@/assets/img/ic-csmeeting.png") center top no-repeat;
          background-size: 48px 42px;
        }
        .changecamera {
          background: url("@/assets/img/ic-videobl.png") center 5px no-repeat;
          background-size: 44px 30px;
          &.cameraoff {
            background: url("@/assets/img/ic-gbvideobl.png") center 2px no-repeat;
            background-size: 48px 36px;
          }
        }
        .changemike {
          background: url("@/assets/img/ic-mkfbl.png") center 3px no-repeat;
          background-size: 38px 38px;
          &.mikeoff {
            background: url("@/assets/img/ic-gbmkfbl.png") center 3px no-repeat;
            background-size: 38px 38px;
          }
        }
        .hyzb {
          background: url("@/assets/img/ic-hyzb.png") center top no-repeat;
          background-size: 48px 48px;
        }
      }
    }
  }
  :deep(.meetingboard-dialog) {
    .el-dialog__body {
      padding: 0;
    }
  }
}
</style>
