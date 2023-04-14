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

// let userList = {}; //用户列表，所有连接的用户
// let userIds = {}; //用户id列表，显示到前端
// let roomList = {}; //房间列表，视频聊天


io.sockets.on('connection', (socket) => {
	// socket代表每一个客户端
	let roomId;
	let UserId;
	socket.on('join', (data) => {
		console.log('用户加入房间, roomId:', data.roomId,'userId:',data.UserId)
		socket.join(data.roomId)
		roomId = data.roomId;
		UserId = data.UserId;
		// const myRoom = io.sockets.adapter.rooms[roomId]
    	const userCount = io.sockets.adapter.rooms.get(data.roomId).size
		// if(roomList.hasOwnProperty(roomId)){
		//   roomList[roomId].push(UserId)
		// }else{
		//   roomList[roomId] = []
		//   roomList[roomId].push(UserId)
		// }

    // const roomInfo = roomList[data.roomId]
		console.log(`the number of user is : ${userCount}`)
		// socket.emit('joined', roomId, socket.id) // 给该客户端单独返回消息。
    // console.log(roomInfo)
		socket.to(data.roomId).emit('joined', {otherUserId:UserId,roomId:data.roomId}, socket.id) // 给房间内，除了自己以外的所有人返回消息。
		// io.in(data.roomId).emit('joined', {
		// 	// 给房间内的所有人都发送消息。
		// 	userCount,
		// 	roomId:data.roomId,
		// 	id: socket.id,
		// })
		// socket.broadcast.emit('joined', roomId, socket.id) // 给出了自己，全部站点的所有人发送消息。broadcast 广播
	})
	socket.on("disconnect", (exit) => {
		//socket断开
		console.log('用户离开房间, roomId:', roomId,'userId:',UserId)
		socket.leave(roomId)
		const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0
			console.log(`the number of user is : ${userCount}`)
		
		socket.to(roomId).emit('leave', {otherUserId:UserId,roomId:roomId}, socket.id) // 给房间内，除了自己以外的所有人返回消息。
	});
	socket.on('leave', () => {
		console.log('用户离开房间, roomId:', roomId,'userId:',UserId)
		socket.leave(roomId)
		// const myRoom = io.sockets.adapter.rooms[roomId]
    	const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0
		console.log(`the number of user is : ${userCount}`)
		// socket.emit('joined', roomId, socket.id) // 给该客户端单独返回消息。
		socket.to(roomId).emit('leave', {otherUserId:UserId,roomId:roomId}, socket.id) // 给房间内，除了自己以外的所有人返回消息。
		// io.in(roomId).emit('left', {
		// 	// 给房间内的所有人都发送消息。
		// 	userCount,
		// 	roomId,
		// 	id: socket.id,
		// }) // 给房间内的所有人都发送消息。
		// socket.broadcast.emit('left', roomId, socket.id) // 给出了自己，全部站点的所有人发送消息。broadcast 广播
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