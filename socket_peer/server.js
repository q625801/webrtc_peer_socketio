const express = require("express");
const app = express();
const server = require("http").Server(app);
const { ExpressPeerServer } = require("peer");
const io = require("socket.io")(server,{ cors: true,allowEIO3: true });
// 配置https
// const fs = require('fs');
// const options = {
//   key: fs.readFileSync('cert.key'),
//   cert: fs.readFileSync('cert.pem')
// };
// const server = require('https').createServer(options,app);

let userList = []; //用户列表，所有连接的用户
// let userIds = {}; //用户id列表，显示到前端
// let roomList = {}; //房间列表，视频聊天


io.sockets.on('connection', (socket) => {
	// socket代表每一个客户端
	let roomId;
	let peerId;
	socket.on('join', (data) => {
		console.log('用户加入房间, roomId:', data.roomId,'peerId:',data.peerId)
		socket.join(data.roomId) //加入对应房间
		roomId = data.roomId;
		peerId = data.peerId;
		userList.push(data)
		console.log(userList, "==================>AdduserList")
		// const myRoom = io.sockets.adapter.rooms[roomId]
    	const userCount = io.sockets.adapter.rooms.get(data.roomId).size


    // const roomInfo = roomList[data.roomId]
		console.log(`the number of user is : ${userCount}`)
		// socket.emit('joined', roomId, socket.id) // 给该客户端单独返回消息。
    // console.log(roomInfo)
		socket.to(data.roomId).emit('joined', {otherpeerId:peerId,roomId:data.roomId,userInfo:data.userInfo}, socket.id) // 给房间内，除了自己以外的所有人返回消息。
		io.in(data.roomId).emit('setUserList', userList.filter(item => item.roomId == data.roomId))
		// socket.broadcast.emit('joined', roomId, socket.id) // 给出了自己，全部站点的所有人发送消息。broadcast 广播
	})
	socket.on("disconnect", (exit) => {
		//socket断开
		console.log('用户离开房间, roomId:', roomId,'peerId:',peerId)
		socket.leave(roomId)
		const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0
			console.log(`the number of user is : ${userCount}`)
		if(userList.length > 0){
			userList.splice(
				userList.findIndex(item => item.peerId == peerId), //当用户离开时删除userList对应数据并通知同房间内所有人
				1,
			);
			io.in(roomId).emit('setUserList', userList.filter(item => item.roomId == roomId))
		}
		console.log(userList, "==================>userList")
		socket.to(roomId).emit('leave', {otherpeerId:peerId,roomId:roomId}, socket.id) // 给房间内，除了自己以外的所有人返回消息。
	});
	socket.on('leave', () => {
		console.log('用户离开房间, roomId:', roomId,'peerId:',peerId)
		socket.leave(roomId)
		// const myRoom = io.sockets.adapter.rooms[roomId]
    	const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0
		console.log(`the number of user is : ${userCount}`)
		// socket.emit('joined', roomId, socket.id) // 给该客户端单独返回消息。
		socket.to(roomId).emit('leave', {otherpeerId:peerId,roomId:roomId}, socket.id) // 给房间内，除了自己以外的所有人返回消息。
		// io.in(roomId).emit('left', {
		// 	// 给房间内的所有人都发送消息。
		// 	userCount,
		// 	roomId,
		// 	id: socket.id,
		// }) // 给房间内的所有人都发送消息。
		// socket.broadcast.emit('left', roomId, socket.id) // 给出了自己，全部站点的所有人发送消息。broadcast 广播
	})
	
	socket.on('cameramike', (data) => {
    	console.log('收到消息cameramike')
		// socket.to(roomId).emit('message', {
		userList.forEach(item => {
			if(item.peerId == peerId){
				if(data.type == "video"){
					item.userInfo.video = data.flag
				}else{
					item.userInfo.mike = data.flag
				}
			}
		})
		io.in(roomId).emit('setUserList', userList.filter(item => item.roomId == roomId))

		socket.to(roomId).emit('cameramike', {otherpeerId:peerId,roomId:roomId,data:data}, socket.id)
	})

	socket.on('message', (roomId, data) => {
    	console.log('收到消息', data)
		// socket.to(roomId).emit('message', {
		io.in(roomId).emit('message', {
			// 给房间内的所有人都发送消息。
			roomId,
			id: socket.id,
			data,
		})
	})
})

const peerServer = ExpressPeerServer(server, {
	debug: true,
	path: "/myapp",
});

app.use("/peerjs", peerServer);

server.listen(9000, function () {
  console.log("Socket Open");
});