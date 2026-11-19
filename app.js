/*
 * forageجون
 *
 * Phase 1
 *
 * Main actions:
 *   add a plant
 *   add an observation to an existing plant
 *
 * Adding a plant creates:
 *   1. A plant record in the directory
 *   2. Its first observation
 */


// --------------------------------------------------
// Local database
// --------------------------------------------------

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("forageجون", 2);

    request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("observations")) {
            db.createObjectStore("observations", {
                keyPath: "id",
                autoIncrement: true
            });
        }

        if (!db.objectStoreNames.contains("plants")) {
            db.createObjectStore("plants", {
                keyPath: "id",
                autoIncrement: true
            });
        }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});


// --------------------------------------------------
// Plants
// --------------------------------------------------

// Add a plant to the directory.
async function savePlant(plant) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            "plants",
            "readwrite"
        );

        const request = transaction
            .objectStore("plants")
            .add(plant);

        request.onsuccess = () => {
            plant.id = request.result;
        };

        transaction.oncomplete = () => resolve(plant);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}


// Load the plant directory.
async function loadPlants() {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            "plants",
            "readonly"
        );

        const request = transaction
            .objectStore("plants")
            .getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


// --------------------------------------------------
// Observations
// --------------------------------------------------

// Add an observation to a plant.
async function saveObservation(observation) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            "observations",
            "readwrite"
        );

        const request = transaction
            .objectStore("observations")
            .add(observation);

        request.onsuccess = () => {
            observation.id = request.result;
        };

        transaction.oncomplete = () => resolve(observation);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}


// Load all observations.
async function loadSavedObservations() {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            "observations",
            "readonly"
        );

        const request = transaction
            .objectStore("observations")
            .getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


// --------------------------------------------------
// Map
// --------------------------------------------------

const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [-118.4452, 33.9582],
    zoom: 15
});



// Show a temporary test observation on the map.
function addObservationMarker(observation) {
    if (
        observation.latitude == null ||
        observation.longitude == null
    ) {
        return;
    }

    const flower = document.createElement("div");
    flower.className = "observation-marker";
    flower.textContent = observation.emoji || ".";

    const popupText = [
        observation.name || "Plant observation",
        observation.notes || ""
    ].filter(Boolean).join("\n");


    const popup = new maplibregl.Popup({
        offset: 25
    }).setText(popupText);

    new maplibregl.Marker({
        element: flower,
        anchor: "bottom"
    })
    .setLngLat([
        observation.longitude,
        observation.latitude
    ])
    .setPopup(popup)
    .addTo(map);
}


// Show an individual plant on the map.

function addPlantMarker(plant, observations = []) {
    // Don't create a marker without coordinates.
    if (
        plant.latitude == null ||
        plant.longitude == null
    ) {
        return;
    }

    const flower = document.createElement("div");
flower.className = "observation-marker color-pink";

    // Find the most recent observation for this plant.
    const latestObservation = [...observations].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    )[0];

    // Build the popup using DOM elements.
    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = plant.nickname || "Plant";
    content.appendChild(title);

    if (latestObservation) {
        const observation = latestObservation;

        // Show the observation date.
        if (observation.timestamp) {
            const date = document.createElement("p");
            date.textContent = new Date(
                observation.timestamp
            ).toLocaleDateString();
            content.appendChild(date);
        }

        // Show the first saved photo, if there is one.
        if (
            observation.photos &&
            observation.photos.length > 0 &&
            observation.photos[0] instanceof Blob
        ) {
            const photo = document.createElement("img");
            photo.src = URL.createObjectURL(observation.photos[0]);
            photo.alt = plant.nickname
                ? `Photo of ${plant.nickname}`
                : "Plant observation photo";

            photo.style.width = "100%";
            photo.style.maxWidth = "240px";
            photo.style.borderRadius = "8px";
            photo.style.display = "block";

            content.appendChild(photo);
        }

        // Show only fields that contain data.
        function addField(label, value) {
            if (!value || !String(value).trim()) {
                return;
            }

            const paragraph = document.createElement("p");
            const heading = document.createElement("strong");

            heading.textContent = label + ": ";
            paragraph.appendChild(heading);
            paragraph.appendChild(
                document.createTextNode(value)
            );

            content.appendChild(paragraph);
        }

        addField("notes", observation.notes);
        addField("ideas", observation.ideas);
        addField("colors", observation.colors);
        addField("textures", observation.textures);
    }

    // Link to this plant's observation history.
    const historyLink = document.createElement("button");
    historyLink.type = "button";
    historyLink.textContent =
        `${observations.length} observations →`;

    historyLink.style.display = "block";
    historyLink.style.marginLeft = "auto";
    historyLink.style.marginTop = "12px";
    historyLink.style.padding = "6px 0";
    historyLink.style.border = "none";
    historyLink.style.background = "none";
    historyLink.style.color = "#3986c8";
    historyLink.style.textDecoration = "underline";
    historyLink.style.cursor = "pointer";

    content.appendChild(historyLink);

    historyLink.addEventListener("click", () => {
        content.innerHTML = "";

        const historyTitle = document.createElement("h3");
        historyTitle.textContent =
            `${plant.nickname || "Plant"} — Observation history`;
        content.appendChild(historyTitle);

        const historyList = document.createElement("div");
        historyList.style.maxHeight = "250px";
        historyList.style.overflowY = "auto";

        const sortedObservations = [...observations].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        sortedObservations.forEach((observation) => {
            const entry = document.createElement("div");
            entry.style.borderBottom = "1px solid #ddd";
            entry.style.padding = "8px 0";

            const date = document.createElement("strong");
            date.textContent = observation.timestamp
                ? new Date(observation.timestamp).toLocaleDateString()
                : "Undated observation";
            entry.appendChild(date);

            if (
                observation.photos &&
                observation.photos[0] instanceof Blob
            ) {
                const photo = document.createElement("img");
                photo.src = URL.createObjectURL(
                    observation.photos[0]
                );
                photo.alt = "Plant observation photo";
                photo.style.width = "100%";
                photo.style.maxWidth = "200px";
                photo.style.display = "block";
                photo.style.marginTop = "6px";
                entry.appendChild(photo);
            }

            [
                ["Notes", observation.notes],
                ["Ideas", observation.ideas],
                ["Colors", observation.colors],
                ["Textures", observation.textures]
            ].forEach(([label, value]) => {
                if (value && value.trim()) {
                    const detail = document.createElement("p");
                    detail.textContent = `${label}: ${value}`;
                    entry.appendChild(detail);
                }
            });

            historyList.appendChild(entry);
        });

        content.appendChild(historyList);

        const backButton = document.createElement("button");
        backButton.type = "button";
        backButton.textContent = "Back to plant";
        backButton.style.marginTop = "10px";

        content.appendChild(backButton);

        backButton.addEventListener("click", () => {
            // Rebuild the original popup by closing and reopening the marker.
            popup.remove();
            addPlantMarker(plant, observations);
        });
    });

    const revisitButton = document.createElement("button");
    revisitButton.textContent = "revisit";
    revisitButton.type = "button";
    revisitButton.style.marginTop = "8px";
    revisitButton.style.padding = "10px 14px";
    revisitButton.style.cursor = "pointer";

    content.appendChild(revisitButton);

    revisitButton.addEventListener("click", () => {
        plantBeingRevisited = plant;

        // A revisit stays at this plant's saved location.
        selectedLocation = {
            longitude: plant.longitude,
            latitude: plant.latitude
        };

        // Clear the form for a new observation.
        newPlantForm.reset();
        clearCurrentPhoto();
        addObservationPhotoButton.textContent = "Add photo";

        // Keep the existing plant's name visible.
        document.getElementById("plant-name").value =
            plant.nickname || "";

        newPlantScreen.classList.remove("hidden");
        popup.remove();
    });

    const popup = new maplibregl.Popup({
        offset: 25,
        maxWidth: "280px"
    }).setDOMContent(content);

    new maplibregl.Marker({
        element: flower,
        anchor: "bottom"
    })
        .setLngLat([
            plant.longitude,
            plant.latitude
        ])
        .setPopup(popup)
        .addTo(map);
}



// Restore plants from the directory when the app opens.

Promise.all([
    loadPlants(),
    loadSavedObservations()
]).then(([plants, observations]) => {
    plants.forEach(plant => {
        const plantObservations = observations.filter(
            observation => observation.plant_id === plant.id
        );

        addPlantMarker(plant, plantObservations);
    });
});


// --------------------------------------------------
// Current location on initial app load
// --------------------------------------------------

getCurrentPosition()
    .then((position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        const locationDot = document.createElement("div");
        locationDot.className = "current-location";

        currentLocationMarker = new maplibregl.Marker({
            element: locationDot,
            anchor: "center"
        })
            .setLngLat([longitude, latitude])
            .addTo(map);

        map.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            speed: 1
        });
    })
    .catch((error) => {
        console.warn("Could not get initial location:", error);
    });


// --------------------------------------------------
// Interface elements
// --------------------------------------------------

const addPlantButton =
    document.getElementById("add-plant-button");

const menuButton =
    document.getElementById("menu-button");

const menuPanel =
    document.getElementById("menu-panel");

const newPlantScreen =
    document.getElementById("new-plant-screen");

const cameraInput =
    document.getElementById("camera-input");

const newPlantForm =
    document.getElementById("new-plant-form");

const plantPhoto =
    document.querySelector(".plant-photo");

let currentPhotoFile = null;
let currentPhotoURL = null;
let plantBeingRevisited = null;
let selectedLocation = null;
let locationSelectionUI = null;
let currentLocationMarker = null;
let formHasBeenStarted = false;
let discardConfirmation = null;


// Ask the browser for the current position. Reject if unavailable so the
// location picker can fall back to the map's existing center.
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("Geolocation is not available."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    });
}


// Clear the optional photo when starting a fresh observation.
function clearCurrentPhoto() {
    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
        currentPhotoURL = null;
    }

    currentPhotoFile = null;
    cameraInput.value = "";
    plantPhoto.innerHTML = "<p>Photo goes here</p>";
    addObservationPhotoButton.textContent = "Add photo";
}
function closeObservationForm() {
    newPlantScreen.classList.add('hidden');
    newPlantForm.reset();
    clearCurrentPhoto();

    formHasBeenStarted = false;
    plantBeingRevisited = null;
    selectedLocation = null;

    if (discardConfirmation) {
        discardConfirmation.remove();
        discardConfirmation = null;
    }
}

function cancelObservationForm() {
    // If the form is untouched, close it immediately.
    if (!formHasBeenStarted) {
        closeObservationForm();
        return;
    }

    // Don't open duplicate confirmation dialogs.
    if (discardConfirmation) return;

    const modal = document.createElement('div');
    modal.className = 'discard-confirmation-backdrop';

    modal.innerHTML = `
        <section
            class="discard-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-confirmation-title"
        >
            <h2 id="discard-confirmation-title">
                Discard this observation?
            </h2>
            <p>Your changes haven't been saved.</p>
            <div class="discard-confirmation-actions">
                <button type="button" class="keep-editing">
                    Keep editing
                </button>
                <button type="button" class="discard-observation">
                    Discard
                </button>
            </div>
        </section>
    `;

    modal.querySelector('.keep-editing').addEventListener('click', () => {
        modal.remove();
        discardConfirmation = null;
    });

    modal.querySelector('.discard-observation').addEventListener('click', () => {
        closeObservationForm();
    });

    // Clicking the dimmed background means keep editing.
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.remove();
            discardConfirmation = null;
        }
    });

    newPlantScreen.appendChild(modal);
    discardConfirmation = modal;
}

// Add the location-picker controls and fixed center crosshair to the map.
function showLocationSelectionUI(
    message = "Move the map to adjust the location."
) {
    if (locationSelectionUI) {
        locationSelectionUI.remove();
    }

    const style = document.createElement("style");
    style.id = "location-selection-styles";
    style.textContent = `
        .location-selection-ui {
            position: absolute;
            inset: 0;
            z-index: 20;
            pointer-events: none;
        }

        .location-crosshair {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 34px;
            height: 34px;
            transform: translate(-50%, -50%);
            color: #222;
            font: 32px/34px sans-serif;
            text-align: center;
            text-shadow: 0 0 3px white, 0 0 5px white;
            user-select: none;
        }

        .location-selection-controls {
            position: absolute;
            left: 50%;
            bottom: max(22px, env(safe-area-inset-bottom));
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 10px;
            width: max-content;
            max-width: calc(100% - 28px);
            padding: 12px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
            pointer-events: auto;
            font: 14px/1.35 system-ui, sans-serif;
        }

        .location-selection-message {
            max-width: 190px;
            color: #333;
        }

        .location-selection-controls button {
            border: 1px solid #bbb;
            border-radius: 8px;
            padding: 10px 12px;
            background: white;
            color: #222;
            font: inherit;
            white-space: nowrap;
            cursor: pointer;
        }

        .location-selection-controls .confirm-location {
            border-color: #222;
            background: #222;
            color: white;
        }

        .add-observation-photo {
            display: block;
            margin: 8px 0 12px;
            padding: 9px 12px;
            border: 1px solid #bbb;
            border-radius: 8px;
            background: white;
            cursor: pointer;
        }

        @media (max-width: 480px) {
            .location-selection-controls {
                gap: 7px;
                padding: 9px;
            }

            .location-selection-message {
                max-width: 120px;
                font-size: 12px;
            }

            .location-selection-controls button {
                padding: 10px 9px;
                font-size: 13px;
            }
        }
    `;

    if (!document.getElementById("location-selection-styles")) {
        document.head.appendChild(style);
    }

    const ui = document.createElement("div");
    ui.className = "location-selection-ui";
    ui.innerHTML = `
        <div class="location-crosshair" aria-hidden="true">⌖</div>
        <div class="location-selection-controls">
            <div class="location-selection-message"></div>
            <button type="button" class="cancel-location">cancel</button>
            <button type="button" class="confirm-location">confirm</button>
        </div>
    `;

    ui.querySelector(".location-selection-message").textContent =
        message;

    ui.querySelector(".cancel-location").addEventListener("click", () => {
        ui.remove();
        locationSelectionUI = null;
        selectedLocation = null;
        addPlantButton.disabled = false;
    });

    ui.querySelector(".confirm-location").addEventListener("click", () => {
        const center = map.getCenter();

        selectedLocation = {
            longitude: center.lng,
            latitude: center.lat
        };

        ui.remove();
        locationSelectionUI = null;
        addPlantButton.disabled = false;
        plantBeingRevisited = null;
        newPlantForm.reset();
        clearCurrentPhoto();
        newPlantScreen.classList.remove("hidden");
        menuPanel.classList.add("hidden");
    });

    map.getContainer().appendChild(ui);
    locationSelectionUI = ui;
    addPlantButton.disabled = false;
}
newPlantForm.addEventListener('input', () => {
    formHasBeenStarted = true;
});

newPlantForm.addEventListener('change', () => {
    formHasBeenStarted = true;
});

// Start with the crosshair centered on the user's current position. If GPS
// fails, still let them choose manually from the map's existing center.
async function beginLocationSelection() {
    if (locationSelectionUI) return;

    selectedLocation = null;
    plantBeingRevisited = null;
    newPlantForm.reset();
    clearCurrentPhoto();
    addPlantButton.disabled = true;
    menuPanel.classList.add("hidden");

    try {
        const position = await getCurrentPosition();
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        if (!currentLocationMarker) {
            const locationDot = document.createElement("div");
            locationDot.className = "current-location";

            currentLocationMarker = new maplibregl.Marker({
                element: locationDot,
                anchor: "center"
            })
                .setLngLat([longitude, latitude])
                .addTo(map);
        } else {
            currentLocationMarker.setLngLat([longitude, latitude]);
        }

        const onCenteringFinished = () => showLocationSelectionUI();

        map.once("moveend", onCenteringFinished);

        map.flyTo({
            center: [longitude, latitude],
            zoom: Math.max(map.getZoom(), 15),
            speed: 1
        });

        // If the map was already centered there, don't wait for moveend.
        if (!map.isMoving()) {
            map.off("moveend", onCenteringFinished);
            showLocationSelectionUI();
        }
    } catch (error) {
        console.warn(
            "Could not get current location; choose manually on the map.",
            error
        );

        showLocationSelectionUI(
            "Location unavailable. Move the map to choose a spot."
        );
    }
}


// The form opens after location confirmation, so make photo-taking optional
// and available from inside the form.
const addObservationPhotoButton = document.createElement("button");
addObservationPhotoButton.type = "button";
addObservationPhotoButton.className = "add-observation-photo";
addObservationPhotoButton.textContent = "Add photo";

addObservationPhotoButton.addEventListener("click", () => {
    cameraInput.click();
});

plantPhoto.insertAdjacentElement(
    "afterend",
    addObservationPhotoButton
);


// --------------------------------------------------
// Menu
// --------------------------------------------------

menuButton.addEventListener("click", () => {
    menuPanel.classList.toggle("hidden");
});


// --------------------------------------------------
// Add a plant
// --------------------------------------------------

addPlantButton.addEventListener("click", () => {
    beginLocationSelection();
});


// --------------------------------------------------
// Photograph taken
// --------------------------------------------------

cameraInput.addEventListener("change", () => {
    const file = cameraInput.files[0];

    if (!file) {
        return;
    }

    currentPhotoFile = file;

    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
    }

    currentPhotoURL = URL.createObjectURL(file);

    plantPhoto.innerHTML = "";

    const image = document.createElement("img");
    image.src = currentPhotoURL;
    image.alt = "Plant photograph";

    plantPhoto.appendChild(image);
    addObservationPhotoButton.textContent = "Change photo";
});


// --------------------------------------------------
// Save a new plant and its first observation
// --------------------------------------------------

newPlantForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const savePlantButton =
        document.getElementById("save-plant-button");

    savePlantButton.disabled = true;
const cancelObservationButton = document.createElement('button');

cancelObservationButton.type = 'button';
cancelObservationButton.textContent = 'Cancel';
cancelObservationButton.className = 'cancel-observation-button';

cancelObservationButton.addEventListener('click', cancelObservationForm);

savePlantButton.insertAdjacentElement(
    'beforebegin',
    cancelObservationButton
);
    
    try {
        // Use the coordinates confirmed on the map, not a fresh GPS reading.
        if (!selectedLocation) {
            throw new Error("No location has been selected.");
        }

        const latitude = selectedLocation.latitude;
        const longitude = selectedLocation.longitude;

        let plant;

        if (plantBeingRevisited) {
            // Revisit: keep the existing plant record and add an observation there.
            plant = plantBeingRevisited;
        } else {
            // New plant: create a directory record at the confirmed location.
            plant = await savePlant({
                latitude,
                longitude,
                nickname: document
                    .getElementById("plant-name")
                    .value.trim(),
                created_at: new Date().toISOString()
            });
        }

        // Create an observation for either path.
        const observation = {
            plant_id: plant.id,
            notes: document
                .getElementById("observation-notes")
                .value.trim(),
            ideas: document
                .getElementById("observation-ideas")
                .value.trim(),
            colors: document
                .getElementById("observation-colors")
                .value.trim(),
            textures: document
                .getElementById("observation-textures")
                .value.trim(),
            latitude,
            longitude,
            timestamp: new Date().toISOString(),
            photos: currentPhotoFile ? [currentPhotoFile] : []
        };

        const savedObservation =
            await saveObservation(observation);

        console.log("Saved observation:", savedObservation);

        // Reload this plant's observations so its popup shows
        // the newest one.
        const allObservations = await loadSavedObservations();

        const plantObservations = allObservations.filter(
            item => item.plant_id === plant.id
        );

        // Remove the old marker for this plant before replacing it.
        // (We'll add reliable marker tracking separately if needed.)
        addPlantMarker(plant, plantObservations);

        // Close and reset the form.
        newPlantScreen.classList.add("hidden");
        newPlantForm.reset();

        if (currentPhotoURL) {
            URL.revokeObjectURL(currentPhotoURL);
        }

        currentPhotoURL = null;
        currentPhotoFile = null;
        cameraInput.value = "";
        plantPhoto.innerHTML = "<p>Photo goes here</p>";
        addObservationPhotoButton.textContent = "Add photo";

        plantBeingRevisited = null;
        selectedLocation = null;

    } catch (error) {
        console.error("Could not save observation:", error);

        alert(
            error.message === "No location has been selected."
                ? "Please choose a location on the map before saving."
                : "The observation could not be saved. Please try again."
        );
    } finally {
        savePlantButton.disabled = false;
    }
});