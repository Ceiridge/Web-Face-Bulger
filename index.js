const FACE_MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models/";

const dropArea = document.getElementById("drop-area");
const loadingArea = document.getElementById("loading-area");
const strengthSlider = document.getElementById("strength-slider");
const strengthSliderValue = document.getElementById("strength-slider-value");
const clearImagesBtn = document.getElementById("clear-images");

dropArea.addEventListener("dragenter", highlight, false);
dropArea.addEventListener("dragover", highlight, false);
dropArea.addEventListener("dragleave", unhighlight, false);
dropArea.addEventListener("drop", handleDrop, false);
document.addEventListener("paste", handlePaste, false);

const audioCtx = new AudioContext();

function highlight(e) {
	e.preventDefault();
	dropArea.classList.add("highlight");
}

function unhighlight(e) {
	if (e) {
		e.preventDefault();
	}

	dropArea.classList.remove("highlight");
}

function handleDrop(e) {
	e.preventDefault();
	const dt = e.dataTransfer;
	const files = dt.files;

	handleFiles(files);
}

function handleFiles(files) {
	for (let i = 0; i < files.length; i++) {
		const file = files[i];

		if (file.type.startsWith("image/")) {
			const img = document.createElement("img");
			img.file = file;

			const reader = new FileReader();
			reader.onload = (function (aImg) {
				return function (e) {
					aImg.src = e.target.result;
					distortImage(img);
				};
			})(img);
			reader.readAsDataURL(file);
		} else if (file.type.startsWith("video/")) {
			distortVideo(URL.createObjectURL(file));
		}
	}

	unhighlight();
}

function handlePaste(event) {
	if (!event.clipboardData.items) {
		return;
	}

	for (const item of event.clipboardData.items) {
		if (item.kind === "file") {
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();

				const img = document.createElement("img");
				img.src = URL.createObjectURL(file);

				img.onload = () => {
					distortImage(img);
				};
			} else if (item.type.startsWith("video/")) {
				const file = item.getAsFile();

				distortVideo(URL.createObjectURL(file));
			}
		}
	}
}

async function initialLoad() {
	await faceapi.loadSsdMobilenetv1Model(FACE_MODELS_URL);

	loadingArea.style.display = "none";
	dropArea.style.display = "inherit";
}

strengthSlider.oninput = () => {
	strengthSliderValue.textContent = strengthSlider.value;
};

clearImagesBtn.onclick = () => {
	for (const canvas of [...document.querySelectorAll(".doneCanvas")]) {
		canvas.remove();
	}
};

initialLoad();


// Bulge Handling

async function distortImage(img) {
	const faces = await faceapi.detectAllFaces(img);
	console.log(faces);

	const canvas = fx.canvas();
	const texture = canvas.texture(img);
	canvas.draw(texture);
	await distortCanvas(faces, canvas);

	document.body.appendChild(canvas);
	canvas.classList.add("doneCanvas");
}

async function distortVideo(vidUrl) {
	await audioCtx.resume();

	const canvas = fx.canvas();
	let texture = null;
	document.body.appendChild(canvas);

	const preCanvas = document.createElement("canvas");
	const ctx = preCanvas.getContext("2d");

	let recorder;
	let recordedChunks = [];

	const auVideo = document.createElement("video");
	auVideo.src = vidUrl;

	let mutex = false;

	await window.getVideoFrames({
		videoUrl: vidUrl,
		async onFrame(frame) {
			while (mutex) {
				await sleep(1);
			}
			mutex = true;

			ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

			if (texture) {
				texture.loadContentsOf(preCanvas);
			} else {
				texture = canvas.texture(preCanvas);
			}

			canvas.draw(texture);
			const faces = await faceapi.detectAllFaces(preCanvas);
			await distortCanvas(faces, canvas);

			if (!recorder) {
				const auDest = audioCtx.createMediaStreamDestination();
				const auSource = audioCtx.createMediaElementSource(auVideo);
				auSource.connect(audioCtx.destination);
				auSource.connect(auDest);
				await auVideo.play();

				recorder = new MediaRecorder(new MediaStream([canvas.captureStream(30).getVideoTracks()[0], auDest.stream.getAudioTracks()[0]]), {
					mimeType: "video/webm"
				});
				recorder.start();

				recorder.ondataavailable = e => {
					recordedChunks.push(e.data);
				};
			}

			frame.close();
			mutex = false;
		},
		onConfig(config) {
			preCanvas.width = config.codedWidth;
			preCanvas.height = config.codedHeight;
		}
	});

	recorder.onstop = () => {
		auVideo.pause();

		const blob = new Blob(recordedChunks, {type: "video/webm"});
		const outputUrl = URL.createObjectURL(blob);

		const outputVideo = document.createElement("video");
		outputVideo.controls = true;
		outputVideo.src = outputUrl;

		const div = document.createElement("div");
		div.classList.add("doneCanvas");

		const btn = document.createElement("a");
		btn.textContent = "Download video";
		btn.download = "video.webm";
		btn.href = outputUrl;

		div.appendChild(btn);
		div.appendChild(outputVideo);
		document.body.appendChild(div);
	};
	recorder.stop();
	canvas.style.display = "none";
}

async function distortCanvas(faces, canvas) {
	const multiplier = parseFloat(strengthSlider.value);

	for (const face of faces) {
		if (face.score < 0.667) {
			continue;
		}

		const centerX = face.box.x + (face.box.width / 2);
		const centerY = face.box.y + (face.box.height / 2);

		let strength = 0.66;
		let maxRadius = Math.max(face.box.width, face.box.height) / 2;
		maxRadius *= multiplier;
		strength *= multiplier;

		canvas.bulgePinch(centerX, centerY, maxRadius, strength);
		// Apply second bulge on forehead
		canvas.bulgePinch(centerX, centerY - (maxRadius / 2), maxRadius * 0.25, strength * 0.25);
	}

	canvas.update();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
