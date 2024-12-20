import Feature from 'https://cdn.skypack.dev/ol/Feature.js';
import LineString from 'https://cdn.skypack.dev/ol/geom/LineString.js';
import Map from 'https://cdn.skypack.dev/ol/Map.js';
import StadiaMaps from 'https://cdn.skypack.dev/ol/source/StadiaMaps.js';
import VectorSource from 'https://cdn.skypack.dev/ol/source/Vector.js';
import View from 'https://cdn.skypack.dev/ol/View.js';
import {Stroke, Style} from 'https://cdn.skypack.dev/ol/style.js';
import {Tile as TileLayer, Vector as VectorLayer} from 'https://cdn.skypack.dev/ol/layer.js';
import {getVectorContext} from 'https://cdn.skypack.dev/ol/render.js';
import {getWidth} from 'https://cdn.skypack.dev/ol/extent.js';

const tileLayer = new TileLayer({
  source: new StadiaMaps({
    layer: 'stamen_toner',
    apikey: '7b9bf11f-b5b9-4023-9309-efb8b5d6eaaa',
  }),
});

const map = new Map({
  layers: [tileLayer],
  target: 'map',
  view: new View({
    center: [-11000000, 4600000],
    zoom: 2,
  }),
});

const style = new Style({
  stroke: new Stroke({
    color: '#EAE911',
    width: 2,
  }),
});

const flightsSource = new VectorSource({
  loader: function () {
    const url = 'flights.json'; // Lokasi file JSON lokal
    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (json) {
        const flightsData = json.flights; // Asumsikan struktur data { flights: [ [from, to], ... ] }
        for (let i = 0; i < flightsData.length; i++) {
          const flight = flightsData[i];
          const from = flight[0];
          const to = flight[1];

          const arcGenerator = new arc.GreatCircle(
            {x: from[1], y: from[0]},
            {x: to[1], y: to[0]}
          );

          const arcLine = arcGenerator.Arc(100, {offset: 10});
          const features = [];
          arcLine.geometries.forEach(function (geometry) {
            const line = new LineString(geometry.coords);
            line.transform('EPSG:4326', 'EPSG:3857');
            features.push(
              new Feature({
                geometry: line,
                finished: false,
              })
            );
          });
          addLater(features, i * 50);
        }
        tileLayer.on('postrender', animateFlights);
      })
      .catch(function (error) {
        console.error('Error loading flight data:', error);
      });
  },
});

const flightsLayer = new VectorLayer({
  source: flightsSource,
  style: function (feature) {
    if (feature.get('finished')) {
      return style;
    }
    return null;
  },
});

map.addLayer(flightsLayer);

const pointsPerMs = 0.02;
function animateFlights(event) {
  const vectorContext = getVectorContext(event);
  const frameState = event.frameState;
  vectorContext.setStyle(style);

  const features = flightsSource.getFeatures();
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    if (!feature.get('finished')) {
      const coords = feature.getGeometry().getCoordinates();
      const elapsedTime = frameState.time - feature.get('start');
      if (elapsedTime >= 0) {
        const elapsedPoints = elapsedTime * pointsPerMs;

        if (elapsedPoints >= coords.length) {
          feature.set('finished', true);
        }

        const maxIndex = Math.min(elapsedPoints, coords.length);
        const currentLine = new LineString(coords.slice(0, maxIndex));

        const worldWidth = getWidth(map.getView().getProjection().getExtent());
        const offset = Math.floor(map.getView().getCenter()[0] / worldWidth);

        currentLine.translate(offset * worldWidth, 0);
        vectorContext.drawGeometry(currentLine);
        currentLine.translate(worldWidth, 0);
        vectorContext.drawGeometry(currentLine);
      }
    }
  }
  map.render();
}

function addLater(features, timeout) {
  window.setTimeout(function () {
    let start = Date.now();
    features.forEach(function (feature) {
      feature.set('start', start);
      flightsSource.addFeature(feature);
      const duration =
        (feature.getGeometry().getCoordinates().length - 1) / pointsPerMs;
      start += duration;
    });
  }, timeout);
}
