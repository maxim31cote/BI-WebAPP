import axios from 'axios';
import md5 from 'md5';

class BlueIrisAPI {
  constructor(baseURL, username, password) {
    this.baseURL = baseURL;
    this.username = username;
    this.password = password;
    this.session = null;
    this.response = null;
    
    // Utiliser le proxy local en développement, l'URL directe en production
    const apiURL = import.meta.env.DEV ? '/api' : baseURL;
    
    this.client = axios.create({
      baseURL: apiURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async login() {
    try {
      console.log('🔑 Tentative de connexion...', { baseURL: this.client.defaults.baseURL });
      
      // Étape 1: Obtenir la session
      const loginResponse = await this.client.post('/json', {
        cmd: 'login'
      });

      console.log('📋 Réponse session:', loginResponse.data);

      // Blue Iris retourne toujours 'fail' à la première requête avec la session
      if (loginResponse.data.session) {
        this.session = loginResponse.data.session;
        this.response = loginResponse.data.response || '';

        // Étape 2: Se connecter avec les credentials
        // Blue Iris utilise: md5(username:session:password) - PASSWORD EN CLAIR !
        // Si response est vide, utiliser la session
        const salt = this.response || this.session;
        const passwordHash = md5(`${this.username}:${salt}:${this.password}`);
        
        console.log('🔐 Tentative d\'authentification avec hash...', {
          username: this.username,
          session: this.session,
          responseSalt: this.response,
          usedSalt: salt,
          finalHash: passwordHash
        });
        
        const authResponse = await this.client.post('/json', {
          cmd: 'login',
          session: this.session,
          response: passwordHash
        });

        console.log('✅ Réponse authentification:', authResponse.data);

        if (authResponse.data.result === 'success') {
          return {
            success: true,
            session: this.session,
            data: authResponse.data.data
          };
        }
      }

      console.error('❌ Échec de l\'authentification');
      return {
        success: false,
        error: 'Authentication failed'
      };
    } catch (error) {
      console.error('❌ Erreur lors de la connexion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCameras() {
    try {
      const response = await this.client.post('/json', {
        cmd: 'camlist',
        session: this.session
      });

      if (response.data.result === 'success') {
        return {
          success: true,
          cameras: response.data.data
        };
      }

      return {
        success: false,
        error: 'Failed to get cameras'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getStatus() {
    try {
      const response = await this.client.post('/json', {
        cmd: 'status',
        session: this.session
      });

      if (response.data.result === 'success') {
        return {
          success: true,
          status: response.data.data
        };
      }

      return {
        success: false,
        error: 'Failed to get status'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getClips(camera = null, startDate = null, endDate = null) {
    try {
      const params = {
        cmd: 'cliplist',
        session: this.session
      };

      if (camera) params.camera = camera;
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;

      const response = await this.client.post('/json', params);

      if (response.data.result === 'success') {
        return {
          success: true,
          clips: response.data.data
        };
      }

      return {
        success: false,
        error: 'Failed to get clips'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async ptzCommand(camera, command, params = {}) {
    try {
      const response = await this.client.post('/json', {
        cmd: 'ptz',
        camera: camera,
        button: command,
        session: this.session,
        ...params
      });

      if (response.data.result === 'success') {
        return {
          success: true
        };
      }

      return {
        success: false,
        error: 'PTZ command failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async triggerCamera(camera) {
    try {
      const response = await this.client.post('/json', {
        cmd: 'trigger',
        camera: camera,
        session: this.session
      });

      return {
        success: response.data.result === 'success'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getStreamURL(camera, quality = 'high') {
    // Blue Iris endpoint /video/ avec les mêmes paramètres qu'UI3 pour JMuxer
    // video/mpeg stream avec paramètres de haute qualité
    return `/video/${camera}/2.0?session=${this.session}&audio=0&stream=0&w=1920&h=1080&q=23&kbps=1000&gop=1000&zfl=1&preset=1&vcs=3&rc=0&extend=2`;
  }

  getSnapshotURL(camera, width = 640, height = 480) {
    // Utiliser un chemin relatif pour passer par le proxy Vite
    return `/image/${camera}?session=${this.session}&w=${width}&h=${height}`;
  }

  async logout() {
    try {
      await this.client.post('/json', {
        cmd: 'logout',
        session: this.session
      });
      
      this.session = null;
      this.response = null;
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default BlueIrisAPI;
