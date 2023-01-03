const dropArea = document.getElementById("drop-area");
const loadingArea = document.getElementById("loading-area");

dropArea.addEventListener("dragenter", highlight, false);
dropArea.addEventListener("dragover", highlight, false);
dropArea.addEventListener("dragleave", unhighlight, false);
dropArea.addEventListener("drop", handleDrop, false);

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
		const imageType = /image.*/;

		if (!file.type.match(imageType)) {
			continue;
		}

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
	}

	unhighlight();
}

async function initialLoad() {
	await faceapi.loadSsdMobilenetv1Model("https://justadudewhohacks.github.io/face-api.js/models/");

	loadingArea.style.display = "none";
	dropArea.style.display = "inherit";
}

async function distortImage(img) {
	const faces = await faceapi.detectAllFaces(img);
	console.log(faces);

	const canvas = fx.canvas();
	const texture = canvas.texture(img);
	canvas.draw(texture);

	for (const face of faces) {
		const centerX = face.box.x + (face.box.width / 2);
		const centerY = face.box.y + (face.box.height / 2);
		const maxRadius = Math.max(face.box.width, face.box.height) / 2;

		canvas.bulgePinch(centerX, centerY, maxRadius, 0.66); // TODO: Test strength
	}

	canvas.update();
	document.body.appendChild(canvas);
}

initialLoad();
