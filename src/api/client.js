import axios from 'axios';
import md5 from 'md5';

class BlueIrisAPI {
  constructor(baseURL, username, password) {
    this.baseURL = baseURL;
    this.username = username;
    this.password = password;
    this.session = null;
    this.response = null;
    
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async login() {
    try {
      // Étape 1: Obtenir la session
      const loginResponse = await this.client.post('/json', {
        cmd: 'login'
      });

      if (loginResponse.data.result !== 'fail') {
        this.session = loginResponse.data.session;
        this.response = loginResponse.data.response;

        // Étape 2: Se connecter avec les credentials
        const passwordHash = md5(`${this.username}:${this.session}:${md5(this.password)}`);
        
        const authResponse = await this.client.post('/json', {
          cmd: 'login',
          session: this.session,
          response: passwordHash
        });

        if (authResponse.data.result === 'success') {
          return {
            success: true,
            session: this.session,
            data: authResponse.data.data
          };
        }
      }

      return {
        success: false,
        error: 'Authentication failed'
      };
    } catch (error) {
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
    const qualityMap = {
      low: 1,
      medium: 5,
      high: 100
    };
    
    return `${this.baseURL}/h264/${camera}/temp.m3u8?session=${this.session}&q=${qualityMap[quality]}`;
  }

  getSnapshotURL(camera, width = 640, height = 480) {
    return `${this.baseURL}/image/${camera}?session=${this.session}&w=${width}&h=${height}`;
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
