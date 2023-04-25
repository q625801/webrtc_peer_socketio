<template>
  <div class="roomList-wrap">
    <div class="listbt">人员列表({{ userlist.length }})</div>
    <div class="list-all">
      <!-- {{ JSON.stringify(userRoomList) }} -->
      <div class="user" v-for="item in userlist" :key="item.id">
        <span>{{ item.userInfo.userName }}</span>
        <div class="mcbtn">
          <div :class="['mikebtn', item.userInfo.mike ? '' : 'off']"></div>
          <div :class="['camerabtn', item.userInfo.video ? '' : 'off']"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, defineProps, reactive, toRefs, onDeactivated } from "vue";
import { useRoute } from "vue-router";
// import { GethyMember, hyMemberattend } from "@/api/hyroom.js";
const route = useRoute();
const state = reactive({
  userlist: [],
});
const props = defineProps(["userList"]);
// let hyMember = () => {
//   GethyMember({ id: route.query?.roomid }).then(res => {
//     if (res.code == 200) {
//       state.userlist = res.data;
//       if (route.query.role == "expert") {
//         Memberattend();
//       }
//     }
//   });
// };
// let Memberattend = () => {
//   state.userlist.forEach(item => {
//     if (item.member.id == route.query.userId) {
//       hyMemberattend({ id: item.id }).then(res => {});
//     }
//   });
// };
watch(
  () => props.userList,
  (newV, oldV) => {
    state.userlist = newV;
  },
  { immediate: true, deep: true },
);
const { userlist } = { ...toRefs(state) };
defineExpose({ userlist });
</script>

<style lang="less" scoped>
.roomList-wrap {
  width: 216px;
  height: 100%;
  background: #f6f6f6;
  .listbt {
    font-size: 16px;
    padding: 15px 0;
    text-align: center;
    border-bottom: 1px solid #bfbfbf;
  }
  .list-all {
    padding: 0 20px;
    .user {
      height: 28px;
      padding-top: 18px;
      position: relative;
      span {
        display: block;
        font-size: 16px;
        font-weight: 400;
        color: #3b3b3b;
        position: relative;
        line-height: 28px;
        padding-left: 36px;
        width: 85px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        &::after {
          content: " ";
          display: block;
          width: 28px;
          height: 28px;
          background: url("@/assets/img/ic-user.png") center no-repeat;
          background-color: rgb(151, 151, 151);
          background-size: 15px 15px;
          border-radius: 50%;
          position: absolute;
          left: 0;
          top: 0;
        }
      }
      .mcbtn {
        position: absolute;
        right: 0;
        top: 18px;
        height: 28px;
        display: flex;
        align-items: center;
        .mikebtn {
          width: 19px;
          height: 20px;
          background: url("@/assets/img/ic-mkf.png") center no-repeat;
          background-size: 15px 20px;
          &.off {
            background: url("@/assets/img/ic-gbmkf.png") center no-repeat;
            background-size: 19px 20px;
          }
        }
        .camerabtn {
          width: 22px;
          height: 19px;
          background: url("@/assets/img/ic-video.png") center no-repeat;
          background-size: 20px 12px;
          margin-left: 12px;
          &.off {
            background: url("@/assets/img/ic-gbvideo.png") center no-repeat;
            background-size: 22px 19px;
          }
        }
      }
    }
  }
}
</style>
