/*
 * Copyright (c) 2025 William y Angel.
 * All rights reserved.
 */
// ==================== ÁLGEBRA LINEAL ====================
    
    // Calcular determinante de matriz 2x2
    function det2x2(a, b, c, d) {
      return a * d - b * c;
    }

    // Calcular determinante de matriz 3x3
    function det3x3(matrix) {
      const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
      return a * det2x2(e, f, h, i) - b * det2x2(d, f, g, i) + c * det2x2(d, e, g, h);
    }

    // Calcular área usando determinante (fórmula del zapato)
    function calculateArea(points) {
      let area = 0;
      const n = points.length;
      
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].lat * points[j].lng;
        area -= points[j].lat * points[i].lng;
      }
      
      return Math.abs(area / 2);
    }

    // Calcular centroide
    function calculateCentroid(points) {
      const sum = points.reduce((acc, p) => ({
        lat: acc.lat + p.lat,
        lng: acc.lng + p.lng
      }), {lat: 0, lng: 0});
      
      return {
        lat: sum.lat / points.length,
        lng: sum.lng / points.length
      };
    }

    // Matriz de rotación
    function rotatePoint(point, center, angleDeg) {
      const angleRad = angleDeg * Math.PI / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      
      const dx = point.lat - center.lat;
      const dy = point.lng - center.lng;
      
      return {
        lat: center.lat + (dx * cos - dy * sin),
        lng: center.lng + (dx * sin + dy * cos)
      };
    }

    // Matriz de traslación
    function translatePoint(point, dx, dy) {
      return {
        lat: point.lat + dy,
        lng: point.lng + dx
      };
    }

    // Matriz de escalado
    function scalePoint(point, center, factor) {
      const dx = point.lat - center.lat;
      const dy = point.lng - center.lng;
      
      return {
        lat: center.lat + dx * factor,
        lng: center.lng + dy * factor
      };
    }

    // ==================== ESTADO DE LA API ====================

    let isApiOnline = false;

    async function checkApiStatus() {
      const indicator = document.getElementById('api-status-indicator');
      try {
        const response = await fetch(`${config.API_URL}/polygons`);
        if (response.ok) {
          indicator.classList.remove('offline');
          indicator.classList.add('online');
          isApiOnline = true;
        } else {
          throw new Error('API no disponible');
        }
      } catch (error) {
        indicator.classList.remove('online');
        indicator.classList.add('offline');
        isApiOnline = false;
        console.error("Error al verificar el estado de la API:", error);
        iziToast.error({ title: 'API Desconectada', message: 'No se pudo conectar al servidor. Algunas funciones pueden no estar disponibles.' });
      }
    }

    // ==================== MAPA Y ESTADO ====================
    
    let map;
    let currentPolygon = null;
    let currentPoints = [];
    let drawingMode = null;
    let markers = [];

    // Inicializar mapa
    function initMap() {
      map = L.map('map', {
        attributionControl: false  // Quita el control de atribución
      }).setView([14.747021040898447, -92.39917751395923], 13); // Centrar el mapa para que sea visible

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
      
      const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3']
      }).addTo(map);
    
      const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{
          maxZoom: 20,
          subdomains:['mt0','mt1','mt2','mt3']
      });

      const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
          maxZoom: 20,
          subdomains:['mt0','mt1','mt2','mt3']
      });
    
      const baseMaps = {
          "Satelite": googleSat,
          "Google Maps": googleStreets,
          "Hibrido": googleHybrid
      };

      const osmb = new OSMBuildings(map).load();

      const overlayMaps = {
          "Edificios 3D": osmb
      };
    
      L.control.layers(baseMaps, overlayMaps).addTo(map);

      map.on('click', onMapClick);
      checkApiStatus(); // Verificar estado de la API al iniciar
    }

    // Manejar clicks en el mapa
    function onMapClick(e) {
      if (drawingMode === 'streetview') {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        const url = `https://www.google.com/maps?q&layer=c&cbll=${lat},${lng}`;
        window.open(url, '_blank');
        drawingMode = null;
        document.getElementById('drawing-feedback').textContent = 'Selecciona una herramienta para comenzar a dibujar.';
        document.getElementById('btnStreetView').classList.remove('active');
        return;
      }

      if (!drawingMode) return;

      const point = {lat: e.latlng.lat, lng: e.latlng.lng};
      
      const maxPoints = drawingMode === 'triangle' ? 3 : 4;

      if (currentPoints.length >= maxPoints) {
        iziToast.warning({
          title: 'Límite alcanzado',
          message: `Ya has colocado los ${maxPoints} puntos para el ${drawingMode}.`
        });
        return;
      }

      currentPoints.push(point);

      const marker = L.marker([point.lat, point.lng]).addTo(map);
      markers.push(marker);

      const pointsLeft = maxPoints - currentPoints.length;
      const feedback = document.getElementById('drawing-feedback');

      if (pointsLeft > 0) {
        feedback.textContent = `Haga clic en el mapa para colocar ${pointsLeft} punto(s) más.`;
      } else {
        feedback.textContent = `Procesando ${drawingMode}...`;
        drawPolygon();
        // Reset drawing mode after completion
        drawingMode = null; 
        document.getElementById('btnTriangle').classList.remove('active');
        document.getElementById('btnQuad').classList.remove('active');
        feedback.textContent = 'Selecciona una herramienta para comenzar a dibujar.';
      }
    }

    // Ordenar puntos para evitar cruces en cuadriláteros
    function sortPointsClockwise(points) {
      const center = calculateCentroid(points);
      
      return points.slice().sort((a, b) => {
        const angleA = Math.atan2(a.lng - center.lng, a.lat - center.lat);
        const angleB = Math.atan2(b.lng - center.lng, b.lat - center.lat);
        return angleA - angleB;
      });
    }

    // Dibujar polígono
    function drawPolygon() {
      if (currentPolygon) {
        map.removeLayer(currentPolygon);
      }

      // Ordenar puntos si es cuadrilátero
      let orderedPoints = currentPoints;
      if (currentPoints.length === 4) {
        orderedPoints = sortPointsClockwise(currentPoints);
        currentPoints = orderedPoints; // Actualizar el array global
      }

      const latlngs = orderedPoints.map(p => [p.lat, p.lng]);
      
      currentPolygon = L.polygon(latlngs, {
        color: '#ff2e2e',
        fillColor: '#ff2e2e',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(map);

      updateInfo();
    }

    // Geocodificación inversa
    async function reverseGeocode(lat, lng) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        return {
          country: data.address.country,
          state: data.address.state,
          city: data.address.city || data.address.town || data.address.village
        };
      } catch (error) {
        console.error("Error en la geocodificación inversa:", error);
        return null;
      }
    }

    // Actualizar información
    async function updateInfo() {
      if (currentPoints.length === 0) {
        document.getElementById('infoZone').textContent = 'No seleccionada';
        document.getElementById('infoCoords').textContent = '--';
        document.getElementById('infoArea').textContent = '--';
        document.getElementById('infoSides').textContent = '--';
        document.getElementById('infoDet').textContent = '--';
        document.getElementById('infoValid').textContent = '--';
        document.getElementById('infoCountry').textContent = '--';
        document.getElementById('infoState').textContent = '--';
        document.getElementById('infoCity').textContent = '--';
        document.getElementById('infoHabitable').textContent = '--';
        document.getElementById('infoCultivable').textContent = '--';
        return;
      }

      const type = currentPoints.length === 3 ? 'Triángulo' : 'Cuadrilátero';
      document.getElementById('infoZone').textContent = type;

      const coordsText = currentPoints.map((p, i) => 
        `P${i+1}(${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`
      ).join(', ');
      document.getElementById('infoCoords').textContent = coordsText;

      // Calcular y mostrar medidas de los lados
      const sidesSpan = document.getElementById('infoSides');
      if (currentPoints.length > 1) {
        let sidesText = '';
        for (let i = 0; i < currentPoints.length; i++) {
          const p1 = L.latLng(currentPoints[i].lat, currentPoints[i].lng);
          const p2 = L.latLng(currentPoints[(i + 1) % currentPoints.length].lat, currentPoints[(i + 1) % currentPoints.length].lng);
          const distance = p1.distanceTo(p2);
          sidesText += `Lado ${i + 1}: ${distance.toFixed(2)} m, `;
        }
        sidesSpan.textContent = sidesText.slice(0, -2); // Remover la última coma y espacio
      } else {
        sidesSpan.textContent = '--';
      }

      const areaGrados = calculateArea(currentPoints);
      
      // Calcular latitud promedio para conversión
      const latPromedio = currentPoints.reduce((sum, p) => sum + p.lat, 0) / currentPoints.length;
      
      // Conversión aproximada a metros cuadrados
      const metrosPorGradoLat = 111320;
      const metrosPorGradoLng = 111320 * Math.cos(latPromedio * Math.PI / 180);
      const areaMetros = areaGrados * metrosPorGradoLat * metrosPorGradoLng;
      const areaKm = areaMetros / 1000000;
      
      // Mostrar ambas unidades
      document.getElementById('infoArea').textContent = 
        `${areaGrados.toFixed(8)} grados² ≈ ${areaMetros.toFixed(2)} m² ≈ ${areaKm.toFixed(6)} km²`;

      document.getElementById('infoHabitable').textContent = 'Analizando...';
      document.getElementById('infoCultivable').textContent = 'Analizando...';

      // Análisis de terreno con datos de elevación
      try {
        const locations = currentPoints.map(p => ({ latitude: p.lat, longitude: p.lng }));
        const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations }),
        });
        if (!response.ok) throw new Error('No se pudo conectar a la API de elevación.');
        const data = await response.json();
        analyzeTerrain(areaMetros, data.results);
      } catch (error) {
        console.error("Error en análisis de terreno:", error);
        document.getElementById('infoHabitable').textContent = `Error: ${error.message}`;
        document.getElementById('infoCultivable').textContent = `Error: ${error.message}`;
      }

      // Geocodificación inversa para cada vértice
      document.getElementById('infoCountry').textContent = 'Buscando...';
      document.getElementById('infoState').textContent = 'Buscando...';
      document.getElementById('infoCity').textContent = 'Buscando...';

      const locations = await Promise.all(
        currentPoints.map(p => reverseGeocode(p.lat, p.lng))
      );

      const validLocations = locations.filter(loc => loc); // Filtrar resultados nulos

      if (validLocations.length > 0) {
        const countries = [...new Set(validLocations.map(loc => loc.country).filter(c => c))].join(', ');
        const states = [...new Set(validLocations.map(loc => loc.state).filter(s => s))].join(', ');
        const cities = [...new Set(validLocations.map(loc => loc.city).filter(city => city))].join(', ');

        document.getElementById('infoCountry').textContent = countries || '--';
        document.getElementById('infoState').textContent = states || '--';
        document.getElementById('infoCity').textContent = cities || '--';
      } else {
        document.getElementById('infoCountry').textContent = 'No disponible';
        document.getElementById('infoState').textContent = 'No disponible';
        document.getElementById('infoCity').textContent = 'No disponible';
      }
    }

function analyzeTerrain(areaMetros, elevationResults) {
    const habitableSpan = document.getElementById('infoHabitable');
    const cultivableSpan = document.getElementById('infoCultivable');

    // Reset styles
    habitableSpan.style.color = '';
    cultivableSpan.style.color = '';

    // Analyze elevation data
    const elevations = elevationResults.map(r => r.elevation);
    const avgElevation = elevations.reduce((sum, el) => sum + el, 0) / elevations.length;
    const elevationStdDev = Math.sqrt(elevations.map(x => Math.pow(x - avgElevation, 2)).reduce((a, b) => a + b) / elevations.length);

    // Criteria for habitability
    const isElevationHabitable = avgElevation > 0 && avgElevation < 2500 && elevationStdDev < 50;

    if (isElevationHabitable) {
        habitableSpan.textContent = '✓ Sí';
        habitableSpan.style.color = '#00ff00';
    } else {
        let reason = '✗ No';
        if (avgElevation <= 0) {
            reason += ' (está en el agua)';
        }
        if (avgElevation >= 2500) {
            reason += ' (elevación demasiado alta)';
        }
        if (elevationStdDev >= 50) {
            reason += ' (terreno demasiado inclinado)';
        }
        habitableSpan.textContent = reason;
        habitableSpan.style.color = '#ff4d4d';
    }

    // Criteria for cultivability
    const isAreaCultivable = areaMetros > 5000;
    const isElevationCultivable = avgElevation > 0 && avgElevation < 1500 && elevationStdDev < 20;

    if (isAreaCultivable && isElevationCultivable) {
        cultivableSpan.textContent = '✓ Sí';
        cultivableSpan.style.color = '#00ff00';
    } else {
        let reason = '✗ No';
        if (!isAreaCultivable) {
            reason += ' (área menor a 5000 m²)';
        }
        if (!isElevationCultivable) {
            if (avgElevation <= 0) {
                reason += ' (está en el agua)';
            }
            if (avgElevation >= 1500) {
                reason += ' (elevación demasiado alta)';
            }
            if (elevationStdDev >= 20) {
                reason += ' (terreno demasiado inclinado)';
            }
        }
        cultivableSpan.textContent = reason;
        cultivableSpan.style.color = '#ff4d4d';
    }
}

    // ==================== TRANSFORMACIONES ====================
    
    function applyRotation(angle) {
      if (currentPoints.length === 0) return;
      
      const center = calculateCentroid(currentPoints);
      currentPoints = currentPoints.map(p => rotatePoint(p, center, angle));
      
      drawPolygon();
      updateMarkers();
    }

    function applyTranslation(dx, dy) {
      if (currentPoints.length === 0) return;
      
      currentPoints = currentPoints.map(p => translatePoint(p, dx, dy));
      
      drawPolygon();
      updateMarkers();
    }

    function applyScaling(factor) {
      if (currentPoints.length === 0) return;
      
      const center = calculateCentroid(currentPoints);
      currentPoints = currentPoints.map(p => scalePoint(p, center, factor));
      
      drawPolygon();
      updateMarkers();
    }

    function updateMarkers() {
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      
      currentPoints.forEach(p => {
        const marker = L.marker([p.lat, p.lng]).addTo(map);
        markers.push(marker);
      });
    }

    // Validar si un cuadrilátero es convexo (sin cruces)
    function isConvexQuadrilateral(points) {
      // Un cuadrilátero es convexo si todos los productos cruzados tienen el mismo signo
      function crossProduct(p1, p2, p3) {
        return (p2.lat - p1.lat) * (p3.lng - p1.lng) - 
               (p2.lng - p1.lng) * (p3.lat - p1.lat);
      }
      
      const signs = [];
      for (let i = 0; i < 4; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % 4];
        const p3 = points[(i + 2) % 4];
        const cross = crossProduct(p1, p2, p3);
        signs.push(Math.sign(cross));
      }
      
      // Todos deben tener el mismo signo (todos positivos o todos negativos)
      return signs.every(s => s === signs[0]) && signs[0] !== 0;
    }

    // ==================== VALIDACIÓN ====================
    
    function validateZone() {
      if (currentPoints.length === 0) {
        alert('No hay zona para validar');
        return;
      }

      const area = calculateArea(currentPoints);
      
      // Calcular determinante para validar orientación
      let det;
      let isValidShape = true;
      
      if (currentPoints.length === 3) {
        const [p1, p2, p3] = currentPoints;
        const matrix = [
          [p1.lat, p1.lng, 1],
          [p2.lat, p2.lng, 1],
          [p3.lat, p3.lng, 1]
        ];
        det = det3x3(matrix);
      } else if (currentPoints.length === 4) {
        // Para cuadriláteros, verificar si es convexo
        isValidShape = isConvexQuadrilateral(currentPoints);
        det = area > 0 ? 1 : -1;
      }

      document.getElementById('infoDet').textContent = det.toFixed(6);

      const isValid = area > 0.000001 && Math.abs(det) > 0.000001 && isValidShape;
      const validText = isValid ? '✓ Zona válida' : '✗ Zona inválida';
      const validColor = isValid ? '#00ff00' : '#ff4d4d';
      
      const validSpan = document.getElementById('infoValid');
      validSpan.textContent = validText;
      validSpan.style.color = validColor;

      if (isValid) {
        iziToast.success({ title: 'Zona validada', message: `Área: ${area.toFixed(6)} grados²<br>Determinante: ${det.toFixed(6)}<br>Forma: ${isValidShape ? 'Convexa ✓' : 'Con cruces ✗'}` });
      } else {
        let reason = 'La zona no es válida.<br>';
        if (area <= 0.000001) reason += '- Área muy pequeña o cero<br>';
        if (Math.abs(det) <= 0.000001) reason += '- Puntos colineales<br>';
        if (!isValidShape) reason += '- Cuadrilátero con líneas cruzadas (no convexo)<br>';
        iziToast.error({ title: 'Error de validación', message: reason });
      }
    }

    // ==================== MODAL ====================
    
    function showModal(type) {
      if (currentPoints.length === 0) {
        alert('Primero dibuja una zona');
        return;
      }

      const modal = document.getElementById('transformModal');
      const title = document.getElementById('modalTitle');
      const inputs = document.getElementById('modalInputs');
      
      inputs.innerHTML = '';
      
      if (type === 'rotate') {
        title.textContent = 'Rotación';
        inputs.innerHTML = '<input type="number" id="rotateAngle" placeholder="Ángulo (grados)" value="45">';
      } else if (type === 'translate') {
        title.textContent = 'Traslación';
        inputs.innerHTML = `
          <input type="number" id="translateX" placeholder="Desplazamiento en X" value="0.001" step="0.001">
          <input type="number" id="translateY" placeholder="Desplazamiento en Y" value="0.001" step="0.001">
        `;
      } else if (type === 'scale') {
        title.textContent = 'Escalado';
        inputs.innerHTML = '<input type="number" id="scaleFactor" placeholder="Factor de escala" value="1.5" step="0.1">';
      }
      
      modal.style.display = 'block';
      modal.dataset.type = type;
    }

    function applyTransformation() {
      const modal = document.getElementById('transformModal');
      const type = modal.dataset.type;
      
      if (type === 'rotate') {
        const angle = parseFloat(document.getElementById('rotateAngle').value);
        applyRotation(angle);
      } else if (type === 'translate') {
        const dx = parseFloat(document.getElementById('translateX').value);
        const dy = parseFloat(document.getElementById('translateY').value);
        applyTranslation(dx, dy);
      } else if (type === 'scale') {
        const factor = parseFloat(document.getElementById('scaleFactor').value);
        applyScaling(factor);
      }
      
      modal.style.display = 'none';
    }

    // ==================== DESCARGAR DOCUMENTO ====================

    async function downloadPdf() {
      if (currentPoints.length === 0) {
        alert('Primero dibuja una zona para poder descargar el reporte.');
        return;
      }

      try {
        iziToast.info({ title: 'Descarga', message: 'Iniciando captura del mapa...' });
        const mapElement = document.getElementById('map');
        const canvas = await html2canvas(mapElement, {
          useCORS: true,
        });
        const mapImageData = canvas.toDataURL('image/png');
        iziToast.info({ title: 'Descarga', message: 'Captura del mapa completada.' });

        const info = {
          zone: document.getElementById('infoZone').textContent,
          coords: document.getElementById('infoCoords').textContent,
          area: document.getElementById('infoArea').textContent,
          determinant: document.getElementById('infoDet').textContent,
          validation: document.getElementById('infoValid').textContent,
          country: document.getElementById('infoCountry').textContent,
          state: document.getElementById('infoState').textContent,
          city: document.getElementById('infoCity').textContent,
        };

        iziToast.info({ title: 'Descarga', message: 'Creando documento PDF...' });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text("Reporte de Zona Geográfica", 105, 20, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        let y = 40;
        doc.text(`Tipo de Zona: ${info.zone}`, 15, y); y += 7;
        doc.text(`Coordenadas: ${info.coords}`, 15, y); y += 7;
        doc.text(`Área Total: ${info.area}`, 15, y); y += 7;
        doc.text(`Determinante: ${info.determinant}`, 15, y); y += 7;
        doc.text(`Validación: ${info.validation}`, 15, y); y += 7;
        doc.text(`País(es): ${info.country}`, 15, y); y += 7;
        doc.text(`Estado(s): ${info.state}`, 15, y); y += 7;
        doc.text(`Ciudad(es): ${info.city}`, 15, y); y += 10;
        
        doc.addImage(mapImageData, 'PNG', 15, y, 180, 100);

        doc.save('reporte_zona.pdf');
        iziToast.success({ title: 'Descarga', message: '¡Descarga iniciada!' });

      } catch (error) {
        console.error("Error al generar el PDF:", error);
        alert('Se produjo un error al generar el PDF: ' + error.message);
        iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF.' });
      }
    }

    // ==================== CONFIGURACIÓN ====================
    const config = {
      API_URL: 'http://127.0.0.1:5001'
    };

    // ==================== GUARDAR Y CARGAR ====================

    function promptToSaveZone() {
      if (currentPoints.length === 0) {
        alert('No hay ninguna zona dibujada para guardar.');
        return;
      }
      document.getElementById('nameModal').style.display = 'block';
    }

    async function saveZone() {
      if (!isApiOnline) {
        iziToast.error({ title: 'Error', message: 'No se puede guardar la zona. La API está desconectada.' });
        return;
      }

      const name = document.getElementById('polygonName').value;
      if (!name) {
        iziToast.warning({ title: 'Advertencia', message: 'Por favor, introduce un nombre para la zona.' });
        return;
      }

      try {
        const response = await fetch(`${config.API_URL}/polygons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, points: currentPoints }),
        });

        if (!response.ok) {
          throw new Error('El servidor respondió con un error.');
        }

        const result = await response.json();
        iziToast.success({ title: 'Éxito', message: `Zona guardada con éxito (ID: ${result.id})` });
        document.getElementById('nameModal').style.display = 'none';
        document.getElementById('polygonName').value = '';
      } catch (error) {
        console.error('Error al guardar la zona:', error);
        iziToast.error({ title: 'Error', message: `Error al guardar la zona: ${error.message}` });
      }
    }

    async function loadAndShowZones() {
      if (!isApiOnline) {
        iziToast.error({ title: 'Error', message: 'No se pueden cargar las zonas. La API está desconectada.' });
        return;
      }

      try {
        const response = await fetch(`${config.API_URL}/polygons`);
        if (!response.ok) {
          throw new Error('No se pudieron cargar las zonas.');
        }
        const polygons = await response.json();

        const listElement = document.getElementById('savedPolygonsList');
        listElement.innerHTML = ''; // Limpiar lista anterior

        if (polygons.length === 0) {
          listElement.innerHTML = '<p>No hay zonas guardadas.</p>';
        } else {
          polygons.forEach(poly => {
            const item = document.createElement('div');
            item.className = 'polygon-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = poly.name;
            nameSpan.onclick = () => {
              if (confirm(`¿Cargar la zona "${poly.name}"? Se limpiará el mapa actual.`)) {
                clearAll();
                currentPoints = poly.points;
                drawPolygon();
                updateMarkers();
                map.fitBounds(currentPolygon.getBounds());
                document.getElementById('loadModal').style.display = 'none';
              }
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.className = 'delete-btn danger';
            deleteBtn.dataset.id = poly.id;
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Evitar que se dispare el evento de carga
                if (confirm(`¿Seguro que quieres eliminar la zona "${poly.name}"?`)) {
                    deleteZone(poly.id);
                }
            };
            
            item.appendChild(nameSpan);
            item.appendChild(deleteBtn);
            listElement.appendChild(item);
          });
        }
        document.getElementById('loadModal').style.display = 'block';
      } catch (error) {
        console.error('Error al cargar zonas:', error);
        iziToast.error({ title: 'Error', message: `Error al cargar zonas: ${error.message}` });
      }
    }

    async function deleteZone(polygonId) {
      if (!isApiOnline) {
        iziToast.error({ title: 'Error', message: 'No se puede eliminar la zona. La API está desconectada.' });
        return;
      }

      try {
        const response = await fetch(`${config.API_URL}/polygons/${polygonId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('El servidor respondió con un error.');
        }

        iziToast.success({ title: 'Éxito', message: 'Zona eliminada con éxito.' });
        
        // Recargar la lista de zonas
        loadAndShowZones();

      } catch (error) {
        console.error('Error al eliminar la zona:', error);
        iziToast.error({ title: 'Error', message: `Error al eliminar la zona: ${error.message}` });
      }
    }

    // ==================== EVENTOS ====================
    
    document.getElementById('btnTriangle').addEventListener('click', () => {
      if (currentPoints.length > 0 && drawingMode !== 'triangle') {
        if (!confirm('¿Limpiar la zona actual para dibujar un triángulo?')) return;
      }
      clearAll();
      drawingMode = 'triangle';
      document.getElementById('drawing-feedback').textContent = 'Haga clic en el mapa para colocar 3 puntos.';
      document.getElementById('btnTriangle').classList.add('active');
      document.getElementById('btnQuad').classList.remove('active');
      document.getElementById('btnStreetView').classList.remove('active');
    });

    document.getElementById('btnQuad').addEventListener('click', () => {
      if (currentPoints.length > 0 && drawingMode !== 'quadrilateral') {
        if (!confirm('¿Limpiar la zona actual para dibujar un cuadrilátero?')) return;
      }
      clearAll();
      drawingMode = 'quadrilateral';
      document.getElementById('drawing-feedback').textContent = 'Haga clic en el mapa para colocar 4 puntos.';
      document.getElementById('btnQuad').classList.add('active');
      document.getElementById('btnTriangle').classList.remove('active');
      document.getElementById('btnStreetView').classList.remove('active');
    });

    document.getElementById('btnRotate').addEventListener('click', () => showModal('rotate'));
    document.getElementById('btnTranslate').addEventListener('click', () => showModal('translate'));
    document.getElementById('btnScale').addEventListener('click', () => showModal('scale'));
    document.getElementById('btnStreetView').addEventListener('click', () => {
      drawingMode = 'streetview';
      document.getElementById('drawing-feedback').textContent = 'Haga clic en el mapa para abrir Street View en esa ubicación.';
      // Deactivate other buttons
      document.getElementById('btnTriangle').classList.remove('active');
      document.getElementById('btnQuad').classList.remove('active');
      document.getElementById('btnStreetView').classList.add('active');
    });
    document.getElementById('btnValidate').addEventListener('click', validateZone);
    document.getElementById('btnDownload').addEventListener('click', downloadPdf);

    document.getElementById('btnClear').addEventListener('click', () => {
      if (confirm('¿Seguro que deseas limpiar todo?')) {
        clearAll();
      }
    });

    document.getElementById('modalApply').addEventListener('click', applyTransformation);
    document.getElementById('modalCancel').addEventListener('click', () => {
      document.getElementById('transformModal').style.display = 'none';
    });

    // Eventos de guardar y cargar
    document.getElementById('btnSave').addEventListener('click', promptToSaveZone);
    document.getElementById('btnLoad').addEventListener('click', loadAndShowZones);

    document.getElementById('modalSaveName').addEventListener('click', saveZone);
    document.getElementById('modalCancelName').addEventListener('click', () => {
      document.getElementById('nameModal').style.display = 'none';
    });
    
    document.getElementById('modalCancelLoad').addEventListener('click', () => {
      document.getElementById('loadModal').style.display = 'none';
    });

    function clearAll() {
      if (currentPolygon) {
        map.removeLayer(currentPolygon);
        currentPolygon = null;
      }
      
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      
      currentPoints = [];
      drawingMode = null;

      // Reset UI elements
      const feedback = document.getElementById('drawing-feedback');
      if(feedback) {
        feedback.textContent = 'Selecciona una herramienta para comenzar a dibujar.';
      }
      document.getElementById('btnTriangle').classList.remove('active');
      document.getElementById('btnQuad').classList.remove('active');
      document.getElementById('btnStreetView').classList.remove('active');
      
      updateInfo();
    }

    // Inicializar al cargar
    window.addEventListener('load', initMap);