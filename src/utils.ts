import http from 'http';
import { ProductCollection } from './settings';

export const getPidList = (lang = 'en'): Promise<Array<ProductCollection>> => {
  const options = {
    host: 'api-us.doiting.com',
    path: `/api/device_product/model?lang=${lang}`,
  };
  return new Promise((resolve, reject) => {
    http.get(options, (res) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'];

      let error;
      // Any 2xx status code signals a successful response but
      // here we're only checking for 200.
      if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
          `Status Code: ${statusCode}`);
      } else if (!/^application\/json/.test(contentType || '')) {
        error = new Error('Invalid content-type.\n' +
          `Expected application/json but received ${contentType}`);
      }
      if (error) {
        reject(error);
        // Consume response data to free up memory
        res.resume();
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);

          if (
            parsedData?.ret !== '1' ||
            !parsedData?.info?.list
          ) {
            resolve([]);
          }
          resolve(parsedData.info.list);
        } catch (e) {
          reject(e);
        }
      });
    });
  });
};
