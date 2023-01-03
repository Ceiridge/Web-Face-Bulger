const FACE_MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models/";

const dropArea = document.getElementById("drop-area");
const loadingArea = document.getElementById("loading-area");
const strengthSlider = document.getElementById("strength-slider");
const strengthSliderValue = document.getElementById("strength-slider-value");

dropArea.addEventListener("dragenter", highlight, false);
dropArea.addEventListener("dragover", highlight, false);
dropArea.addEventListener("dragleave", unhighlight, false);
dropArea.addEventListener("drop", handleDrop, false);
document.addEventListener("paste", handlePaste, false);

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

function handlePaste(event) {
	if (event.clipboardData.items) {
		const file = event.clipboardData.items[0].getAsFile();
		if (file.type.startsWith("image/")) {
			const img = document.createElement("img");
			img.src = URL.createObjectURL(file);

			img.onload = () => {
				distortImage(img);
			};
		}
	}
}

async function initialLoad() {
	await faceapi.loadSsdMobilenetv1Model(FACE_MODELS_URL);

	loadingArea.style.display = "none";
	dropArea.style.display = "inherit";
}

async function distortImage(img) {
	const faces = await faceapi.detectAllFaces(img);
	console.log(faces);

	const canvas = fx.canvas();
	const texture = canvas.texture(img);
	canvas.draw(texture);

	const multiplier = parseFloat(strengthSlider.value);

	for (const face of faces) {
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
	document.body.appendChild(canvas);
}

strengthSlider.oninput = () => {
	strengthSliderValue.textContent = strengthSlider.value;
};

initialLoad();
