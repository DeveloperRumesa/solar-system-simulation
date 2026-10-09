// 1. SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Enable shadow mapping
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for better quality

document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const infoBox = document.getElementById('info-box');
const infoTitle = document.getElementById('info-title');
const infoText = document.getElementById('info-text');

let isPaused = false;
let isZoomingToPlanet = false;
let selectedPlanet = null;
let cameraTargetPos = new THREE.Vector3(0, 500, 1000);
let cameraStartPos = new THREE.Vector3(0, 400, 800);
let transitionProgress = 0;
let transitionDuration = 0;

// Easing function for smooth transitions
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Function to hide all moons with fade out
function hideAllMoons() {
    planets.forEach(planet => {
        planet.moons.forEach(moon => {
            moon.mesh.material.transparent = true;
            moon.mesh.material.opacity = 0;
            moon.mesh.visible = false;
            moon.mesh.children.forEach(child => {
                if (child.name) {
                    child.material.transparent = true;
                    child.material.opacity = 0;
                    child.visible = false;
                }
            });
            moon.orbit.material.transparent = true;
            moon.orbit.material.opacity = 0;
            moon.orbit.visible = false;
        });
    });
}

// Function to show moons for a specific planet with fade in
function showPlanetMoons(planetMesh) {
    hideAllMoons(); // Hide all moons first
    const planet = planets.find(p => p.mesh === planetMesh);
    if (planet && planet.moons.length > 0) {
        planet.moons.forEach((moon, index) => {
            // Stagger the fade-in for visual appeal
            setTimeout(() => {
                moon.mesh.material.transparent = true;
                moon.mesh.material.opacity = 0;
                moon.mesh.visible = true;
                
                moon.mesh.children.forEach(child => {
                    if (child.name) {
                        child.material.transparent = true;
                        child.material.opacity = 0;
                        child.visible = true;
                    }
                });
                
                moon.orbit.material.transparent = true;
                moon.orbit.material.opacity = 0;
                moon.orbit.visible = true;
                
                // Animate fade-in
                let fadeProgress = 0;
                const fadeIn = () => {
                    fadeProgress += 0.05;
                    const opacity = Math.min(1, fadeProgress);
                    moon.mesh.material.opacity = opacity;
                    moon.orbit.material.opacity = opacity * 0.15;
                    moon.mesh.children.forEach(child => {
                        if (child.name && child.material) {
                            child.material.opacity = opacity;
                        }
                    });
                    if (opacity < 1) {
                        requestAnimationFrame(fadeIn);
                    }
                };
                fadeIn();
            }, index * 100); // Stagger by 100ms per moon
        });
    }
}

// 2. DATA (Updated with Planets and Nearby Stars)
const educationalContent = {
    // Planets
    "Sun": "The Sun contains 99.8% of the total mass of the Solar System.",
    "Mercury": "Mercury is the smallest planet and closest to the Sun.",
    "Venus": "Venus is the hottest planet due to its thick atmosphere.",
    "Earth": "Earth is the only planet known to have liquid water.It takes approximately 8 minutes for the sunlight to reachthe earth",
    "Mars": "Mars is known as the Red Planet due to iron oxide.",
    "Jupiter": "Jupiter is the largest planet in our solar system.",
    "Saturn": "Saturn is famous for its complex ring system.",
    "Uranus": "Uranus is an ice giant that rotates on its side.",
    "Neptune": "Neptune is the most distant planet from the Sun.",
    
    // Nearby Stars (New Features)
    "Sirius": "The brightest star in Earth's night sky, located 8.6 light-years away.",
    "Alpha Centauri": "The closest star system to our Solar System, consisting of three stars.",
    "Proxima Centauri": "A small, low-mass star, the nearest known star to the Sun."
};
// 3. HELPERS
function createLabel(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512; canvas.height = 256;
    ctx.font = 'Bold 80px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(text.toUpperCase(), 256, 128);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.scale.set(50, 25, 1);
    return sprite;
}

// Function to create planetary rings
function createPlanetRings(innerRadius, outerRadius, color, opacity) {
    const ringGroup = new THREE.Group();
    
    // Create multiple ring layers for more realistic appearance
    const ringLayers = 3;
    for (let i = 0; i < ringLayers; i++) {
        const layerOpacity = opacity * (1 - i * 0.2);
        const layerInner = innerRadius + (outerRadius - innerRadius) * (i / ringLayers);
        const layerOuter = innerRadius + (outerRadius - innerRadius) * ((i + 1) / ringLayers);
        
        const ringGeometry = new THREE.RingGeometry(layerInner, layerOuter, 128);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: layerOpacity
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2; // Lay flat
        ringGroup.add(ring);
    }
    
    return ringGroup;
}

// 4. LIGHTING
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// Enhanced sun light with shadow casting
// Use DirectionalLight for better shadow quality (sun is effectively directional from far away)
const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(0, 0, 0);
sunLight.castShadow = true;

// Configure shadow camera to cover the entire solar system
sunLight.shadow.camera.left = -1000;
sunLight.shadow.camera.right = 1000;
sunLight.shadow.camera.top = 1000;
sunLight.shadow.camera.bottom = -1000;
sunLight.shadow.camera.near = 0.1;
sunLight.shadow.camera.far = 2000;

// Shadow map quality settings
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0001; // Reduce shadow acne
sunLight.shadow.normalBias = 0.02; // Additional bias for smooth surfaces

scene.add(sunLight);

// Keep a point light for general illumination (non-shadow casting)
const sunPointLight = new THREE.PointLight(0xffffff, 1.5, 2000);
sunPointLight.position.set(0, 0, 0);
scene.add(sunPointLight);

// 5. THE SUN
function createSunGlow() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Create a radial gradient: white center -> yellow -> transparent edge
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 220, 0, 0.7)');
    gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
        map: texture, 
        blending: THREE.AdditiveBlending, // Makes it "glow" against the background
        transparent: true 
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(150, 150, 1); // Much larger than the sun mesh
    return sprite;
}
// If 'sun.jpg' is missing, it stays yellow
// 5. THE SUN
const sunGroup = new THREE.Group(); // Group keeps mesh and glow together
scene.add(sunGroup);

const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(35, 32, 32),
    new THREE.MeshBasicMaterial({ 
        map: textureLoader.load('sun.jpg'),
        color: 0xffcc00 
    })
);
sunMesh.name = "Sun";
sunMesh.castShadow = false; // Sun is the light source, doesn't cast shadows
sunMesh.receiveShadow = false;
sunGroup.add(sunMesh);

// Add the Glow
const glow = createSunGlow();
sunGroup.add(glow);

// Add Title to Sun
const sunLabel = createLabel("SUN");
sunLabel.position.y = 50; 
sunGroup.add(sunLabel);

// 6. STARS (General Background)
const starVertices = [];
// Using 5000 as requested for a balanced space density
for (let i = 0; i < 4000; i++) {
    starVertices.push(
        (Math.random() - 0.5) * 10000, // Increased spread for a deeper universe
        (Math.random() - 0.5) * 10000, 
        (Math.random() - 0.5) * 10000
    );
}

const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));

const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.0 });
scene.add(new THREE.Points(starGeo, starMat));


// 6.5. INTERACTIVE NEARBY STARS (Visit-able destinations)
function addNearbyStars() {
    const starNames = ["Sirius", "Alpha Centauri", "Proxima Centauri"];
    const starGroup = new THREE.Group();

    starNames.forEach((name) => {
        const size = 5 + Math.random() * 3; // Larger sphere geometry for raycasting detection
        const starGeo = new THREE.SphereGeometry(size, 16, 16);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const starMesh = new THREE.Mesh(starGeo, starMat);

        starMesh.name = name; // Identifier for the Raycaster interaction

        // POSITIONING: Mathematics Foundations (Spherical Coordinates)
        // Position them far beyond the Kuiper Belt (distance > 1800)
        const distance = 1800 + Math.random() * 500;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        // Converting Spherical Coordinates to Cartesian (x, y, z)
        starMesh.position.set(
            distance * Math.sin(phi) * Math.cos(theta),
            distance * Math.sin(phi) * Math.sin(theta),
            distance * Math.cos(phi)
        );

        // Add Label & Glow (Week 10 & 11: Text Attributes and Filtering)
        starMesh.add(createLabel(name)); 
        const starGlow = createSunGlow();
        starGlow.scale.set(size * 15, size * 15, 1);
        starMesh.add(starGlow);

        starGroup.add(starMesh);
    });

    scene.add(starGroup);
    return starGroup;
}

// Execute function to add these to the scene
const nearbyStars = addNearbyStars();

// 7. PLANETS
const planetsData = [
    { name: "Mercury", size: 4, distance: 100, speed: 0.006, color: 0xaaaaaa, file: 'mercury.jpg', moons: [], rings: null },
    { name: "Venus", size: 7, distance: 140, speed: 0.005, color: 0xffd39b, file: 'venus.jpg', moons: [], rings: null },
    { name: "Earth", size: 8, distance: 190, speed: 0.003, color: 0x2233ff, file: 'earth.jpg', moons: [
        { name: "Moon", size: 2, distance: 25, speed: 0.015, color: 0xcccccc }
    ], rings: null },
    { name: "Mars", size: 6, distance: 250, speed: 0.0025, color: 0xff4500, file: 'mars.jpg', moons: [
        { name: "Phobos", size: 1, distance: 15, speed: 0.025, color: 0x888888 },
        { name: "Deimos", size: 0.8, distance: 20, speed: 0.02, color: 0x666666 }
    ], rings: null },
    { name: "Jupiter", size: 18, distance: 350, speed: 0.0012, color: 0xd2b48c, file: 'jupiter.jpg', moons: [
        { name: "Io", size: 2.5, distance: 35, speed: 0.03, color: 0xffaa44 },
        { name: "Europa", size: 2.2, distance: 45, speed: 0.025, color: 0x88aaff },
        { name: "Ganymede", size: 3, distance: 55, speed: 0.02, color: 0x999999 },
        { name: "Callisto", size: 2.8, distance: 65, speed: 0.015, color: 0x777777 }
    ], rings: { innerRadius: 20, outerRadius: 25, color: 0x8b7355, opacity: 0.3 } },
    { name: "Saturn", size: 15, distance: 450, speed: 0.001, color: 0xf0e68c, file: 'saturn.jpg', moons: [
        { name: "Titan", size: 3.5, distance: 40, speed: 0.022, color: 0xffcc99 },
        { name: "Enceladus", size: 1.8, distance: 30, speed: 0.028, color: 0xffffff },
        { name: "Mimas", size: 1.5, distance: 25, speed: 0.03, color: 0xaaaaaa },
        { name: "Rhea", size: 2.5, distance: 35, speed: 0.025, color: 0xcccccc }
    ], rings: { innerRadius: 18, outerRadius: 30, color: 0xc9b99b, opacity: 0.6 } },
    { name: "Uranus", size: 11, distance: 540, speed: 0.0006, color: 0xadd8e6, file: 'uranus.jpg', moons: [
        { name: "Titania", size: 2.2, distance: 30, speed: 0.02, color: 0xaaaaaa },
        { name: "Oberon", size: 2, distance: 35, speed: 0.016, color: 0x999999 },
        { name: "Ariel", size: 1.8, distance: 25, speed: 0.022, color: 0xbbbbbb },
        { name: "Umbriel", size: 1.7, distance: 28, speed: 0.02, color: 0x888888 }
    ], rings: { innerRadius: 13, outerRadius: 18, color: 0x88aadd, opacity: 0.4 } },
    { name: "Neptune", size: 11, distance: 620, speed: 0.0003, color: 0x000080, file: 'neptune.jpg', moons: [
        { name: "Triton", size: 2.5, distance: 32, speed: 0.02, color: 0x88aaff },
        { name: "Nereid", size: 1.2, distance: 40, speed: 0.013, color: 0x777777 },
        { name: "Proteus", size: 1.5, distance: 28, speed: 0.022, color: 0x666666 }
    ], rings: { innerRadius: 13, outerRadius: 17, color: 0x4466aa, opacity: 0.3 } }
];

const planets = [];
planetsData.forEach(data => {
    // A. Create Planet Mesh
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(data.size, 32, 32), 
        new THREE.MeshStandardMaterial({ 
            map: textureLoader.load(data.file), 
            color: 0xffffff 
        })
    );
    mesh.name = data.name;
    
    // Enable shadow casting for planets
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // B. Create Planet Title (Label)
    const label = createLabel(data.name);
    label.position.y = data.size + 12;
    mesh.add(label);

    // B.5. CREATE PLANETARY RINGS (if planet has rings)
    let rings = null;
    if (data.rings) {
        rings = createPlanetRings(
            data.rings.innerRadius,
            data.rings.outerRadius,
            data.rings.color,
            data.rings.opacity
        );
        mesh.add(rings); // Add rings as child of planet so they rotate with it
    }

    // C. CREATE ORBIT LINE
    // RingGeometry(innerRadius, outerRadius, segments)
    const orbitGeometry = new THREE.RingGeometry(data.distance - 0.5, data.distance + 0.5, 128);
    const orbitMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.2 // Adjust this if the lines are too faint or too bright
    });
    const orbitMesh = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbitMesh.rotation.x = Math.PI / 2; // Lay it flat
    scene.add(orbitMesh);

    // D. CREATE MOONS FOR THIS PLANET
    const moons = [];
    data.moons.forEach(moonData => {
        // Create moon mesh with transparent material for smooth transitions
        const moonMaterial = new THREE.MeshStandardMaterial({ 
            color: moonData.color,
            transparent: true,
            opacity: 0
        });
        const moonMesh = new THREE.Mesh(
            new THREE.SphereGeometry(moonData.size, 16, 16),
            moonMaterial
        );
        moonMesh.name = moonData.name;
        
        // Enable shadow receiving for moons (they enter planet shadows)
        moonMesh.castShadow = true;
        moonMesh.receiveShadow = true;
        
        // Create moon label with transparency
        const moonLabel = createLabel(moonData.name);
        moonLabel.scale.set(20, 10, 1); // Smaller labels for moons
        moonLabel.position.y = moonData.size + 5;
        moonLabel.material.transparent = true;
        moonLabel.material.opacity = 0;
        moonMesh.add(moonLabel);
        
        // Create moon orbit line
        const moonOrbitGeometry = new THREE.RingGeometry(moonData.distance - 0.2, moonData.distance + 0.2, 64);
        const moonOrbitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x88aaff, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0
        });
        const moonOrbitMesh = new THREE.Mesh(moonOrbitGeometry, moonOrbitMaterial);
        moonOrbitMesh.rotation.x = Math.PI / 2;
        moonOrbitMesh.name = moonData.name + "_orbit";
        
        // Hide moons by default
        moonMesh.visible = false;
        moonLabel.visible = false;
        moonOrbitMesh.visible = false;
        
        // Add moon orbit to planet (so it moves with planet)
        mesh.add(moonOrbitMesh);
        // Add moon to planet (so it orbits around planet)
        mesh.add(moonMesh);
        
        moons.push({ 
            mesh: moonMesh, 
            orbit: moonOrbitMesh,
            distance: moonData.distance, 
            speed: moonData.speed, 
            angle: Math.random() * Math.PI * 2 
        });
    });

    // E. Add everything to scene and tracking array
    scene.add(mesh);
    planets.push({ 
        mesh, 
        distance: data.distance, 
        speed: data.speed, 
        angle: Math.random() * Math.PI * 2,
        moons: moons, // Store moons reference
        rings: rings // Store rings reference
    });
});

// 7.5. ASTEROID BELT (Between Mars and Jupiter)
function createAsteroidBelt() {
    const asteroidBelt = new THREE.Group();
    const asteroidCount = 2000; // Number of asteroids
    const innerRadius = 280; // Between Mars (250) and Jupiter (350)
    const outerRadius = 320;
    const asteroidGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    
    for (let i = 0; i < asteroidCount; i++) {
        // Random angle around the sun
        const angle = Math.random() * Math.PI * 2;
        // Random distance between inner and outer radius
        const distance = innerRadius + Math.random() * (outerRadius - innerRadius);
        // Random height variation
        const height = (Math.random() - 0.5) * 20;
        
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = height;
        
        positions.push(x, y, z);
        
        // Random asteroid colors (brownish/grayish)
        const colorVariation = Math.random() * 0.3 + 0.5;
        colors.push(colorVariation, colorVariation * 0.8, colorVariation * 0.6);
    }
    
    asteroidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    asteroidGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const asteroidMaterial = new THREE.PointsMaterial({
        size: 2.0, // Increased base size
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true, // Size scales with distance - this fixes zoom issue
        depthWrite: false // Helps with rendering
    });
    
    const asteroids = new THREE.Points(asteroidGeometry, asteroidMaterial);
    asteroidBelt.add(asteroids);
    asteroidBelt.name = "AsteroidBelt";
    
    return asteroidBelt;
}

// 7.6. KUIPER BELT (Beyond Neptune)
function createKuiperBelt() {
    const kuiperBelt = new THREE.Group();
    const kuiperCount = 3000; // More objects in Kuiper Belt
    const innerRadius = 680; // Beyond Neptune (620)
    const outerRadius = 750;
    const kuiperGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    
    for (let i = 0; i < kuiperCount; i++) {
        // Random angle around the sun
        const angle = Math.random() * Math.PI * 2;
        // Random distance between inner and outer radius
        const distance = innerRadius + Math.random() * (outerRadius - innerRadius);
        // Random height variation (more spread out)
        const height = (Math.random() - 0.5) * 30;
        
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = height;
        
        positions.push(x, y, z);
        
        // Kuiper Belt objects are more icy/blueish
        const colorVariation = Math.random() * 0.2 + 0.4;
        const blueTint = Math.random() * 0.3 + 0.5;
        colors.push(colorVariation, colorVariation * 0.9, blueTint);
    }
    
    kuiperGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    kuiperGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const kuiperMaterial = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true, // Size scales with distance
        depthWrite: false
    });
    
    const kuiperObjects = new THREE.Points(kuiperGeometry, kuiperMaterial);
    kuiperBelt.add(kuiperObjects);
    kuiperBelt.name = "KuiperBelt";
    
    return kuiperBelt;
}

const asteroidBelt = createAsteroidBelt();
scene.add(asteroidBelt);

const kuiperBelt = createKuiperBelt();
scene.add(kuiperBelt);

// 8. CONTROLS
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
camera.position.set(0, 400, 800);

// 9. UPDATED INTERACTION (Sun-Centered Zoom)
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        // Helper function to check if an object is a moon or moon-related
        function isMoonOrMoonRelated(obj) {
            if (!obj) return false;
            // Check if it's a moon orbit
            if (obj.name && obj.name.includes("_orbit")) return true;
            // Check if it's a moon mesh
            if (planets.some(p => p.moons.some(m => m.mesh === obj))) return true;
            // Check if it's a child of a moon (like a moon label)
            let current = obj.parent;
            while (current) {
                if (planets.some(p => p.moons.some(m => m.mesh === current))) return true;
                current = current.parent;
            }
            return false;
        }
        
        // Find if we hit a planet or its label (but not a moon)
        const hit = intersects.find(i => {
            // Skip moons and moon orbits
            if (isMoonOrMoonRelated(i.object)) {
                return false;
            }
            return educationalContent[i.object.name] || (i.object.parent && educationalContent[i.object.parent.name]);
        });
        
        if (hit) {
            const obj = educationalContent[hit.object.name] ? hit.object : hit.object.parent;
            
            // Smooth info box transition
            infoBox.style.opacity = '0';
            infoBox.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                infoTitle.innerText = obj.name;
                infoText.innerText = educationalContent[obj.name];
                infoBox.style.display = 'block';
                setTimeout(() => {
                    infoBox.style.opacity = '1';
                    infoBox.style.transform = 'translateY(0)';
                }, 10);
            }, 150);
            
            isPaused = true;
            selectedPlanet = obj;

            // Start smooth camera transition
            cameraStartPos.copy(camera.position);
            const direction = new THREE.Vector3().copy(obj.position).normalize();
            const distanceToPlanet = obj.position.length();
            cameraTargetPos.copy(direction.multiplyScalar(distanceToPlanet + 50));
            cameraTargetPos.y += 30;
            
            transitionProgress = 0;
            transitionDuration = 60; // frames for transition
            isZoomingToPlanet = true;

            // Show moons for this planet with delay
            setTimeout(() => showPlanetMoons(obj), 300);
        } else {
            // Clicked on a moon or empty space - reset to overview
            infoBox.style.opacity = '0';
            infoBox.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                infoBox.style.display = 'none';
            }, 300);
            
            isPaused = false;
            selectedPlanet = null;
            
            // Smooth camera transition back
            cameraStartPos.copy(camera.position);
            cameraTargetPos.set(0, 500, 1000);
            transitionProgress = 0;
            transitionDuration = 60;
            isZoomingToPlanet = true;
            
            hideAllMoons(); // Hide all moons when clicking away
        }
    } else {
        // Reset to overview
        infoBox.style.opacity = '0';
        infoBox.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            infoBox.style.display = 'none';
        }, 300);
        
        isPaused = false;
        selectedPlanet = null;
        
        // Smooth camera transition back
        cameraStartPos.copy(camera.position);
        cameraTargetPos.set(0, 500, 1000);
        transitionProgress = 0;
        transitionDuration = 60;
        isZoomingToPlanet = true;
        
        hideAllMoons(); // Hide all moons when clicking away
    }
});

// Add these listeners to stop automatic flying if the user manual zooms/drags
window.addEventListener('wheel', () => { isZoomingToPlanet = false; });
window.addEventListener('mousedown', () => { isZoomingToPlanet = false; });

// 10. UPDATED ANIMATION LOOP (Sun-Centered Lock)
function animate() {
    requestAnimationFrame(animate);

    // Enhanced smooth camera transition with easing
    if (isZoomingToPlanet) {
        transitionProgress++;
        const t = Math.min(1, transitionProgress / transitionDuration);
        const easedT = easeInOutCubic(t);
        
        // Interpolate camera position with easing
        camera.position.lerpVectors(cameraStartPos, cameraTargetPos, easedT);
        
        // Smooth camera look-at towards target
        const lookAtTarget = selectedPlanet ? selectedPlanet.position : new THREE.Vector3(0, 0, 0);
        const currentDirection = new THREE.Vector3();
        camera.getWorldDirection(currentDirection);
        
        const targetDirection = lookAtTarget.clone().sub(camera.position).normalize();
        const smoothedDirection = currentDirection.clone().lerp(targetDirection, 0.1);
        const lookAtPoint = camera.position.clone().add(smoothedDirection.multiplyScalar(100));
        camera.lookAt(lookAtPoint);
        
        if (t >= 1) {
            isZoomingToPlanet = false;
            transitionProgress = 0;
            // Ensure final look-at is correct
            if (selectedPlanet) {
                camera.lookAt(selectedPlanet.position);
            } else {
                camera.lookAt(0, 0, 0);
            }
        }
    }

    

    // Update shadow camera to follow the solar system
    // Keep directional light pointing outward from sun
    sunLight.position.set(0, 0, 0);
    sunLight.target.position.set(0, 0, 500); // Point toward outer planets
    sunLight.target.updateMatrixWorld();
    
    // Update shadow camera to cover all planets
    const maxDistance = 750; // Cover up to Kuiper belt
    sunLight.shadow.camera.left = -maxDistance;
    sunLight.shadow.camera.right = maxDistance;
    sunLight.shadow.camera.top = maxDistance;
    sunLight.shadow.camera.bottom = -maxDistance;
    sunLight.shadow.camera.updateProjectionMatrix();

    if (!isPaused) {
        // Normal mode: all planets orbit and rotate
        planets.forEach(p => {
            p.angle += p.speed;
            p.mesh.position.x = Math.cos(p.angle) * p.distance;
            p.mesh.position.z = Math.sin(p.angle) * p.distance;
            p.mesh.rotation.y += 0.003; // Planet rotation around its axis
            
            // Rotate rings with the planet
            if (p.rings) {
                p.rings.rotation.z += 0.001; // Slow ring rotation
            }
            
            // Animate moons around their parent planet
            p.moons.forEach(moon => {
                moon.angle += moon.speed;
                moon.mesh.position.x = Math.cos(moon.angle) * moon.distance;
                moon.mesh.position.z = Math.sin(moon.angle) * moon.distance;
            });
        });
        
        // Rotate asteroid belt slowly
        if (asteroidBelt) {
            asteroidBelt.rotation.y += 0.0005;
        }
        
        // Rotate Kuiper Belt slowly
        if (kuiperBelt) {
            kuiperBelt.rotation.y += 0.0003;
        }
    } else {
        // Paused mode: only selected planet rotates around its axis
        if (selectedPlanet) {
            const planet = planets.find(p => p.mesh === selectedPlanet);
            if (planet) {
                // Continue rotating the selected planet around its own axis
                planet.mesh.rotation.y += 0.003;
                
                // Rotate rings with the selected planet
                if (planet.rings) {
                    planet.rings.rotation.z += 0.001;
                }
                
                // Animate moons around the selected planet
                planet.moons.forEach(moon => {
                    moon.angle += moon.speed;
                    moon.mesh.position.x = Math.cos(moon.angle) * moon.distance;
                    moon.mesh.position.z = Math.sin(moon.angle) * moon.distance;
                });
            }
        }
        // All other planets remain frozen (no rotation, no orbit)
    }

    // LOCK TARGET TO SUN (0,0,0)
    // This ensures that manual scrolling/zooming always centers on the Sun
    controls.target.set(0, 0, 0);

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});