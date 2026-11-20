import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath(DRACO_DECODER_PATH)

/** The one GLTF loader for the app, with Draco decoding, so every model decodes the same way. */
export const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)
