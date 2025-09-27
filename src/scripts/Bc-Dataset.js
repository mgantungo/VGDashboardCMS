
const https = require('https');
const http = require('http');
const fs = require('fs');
const { URL } = require('url');



const STRAPI_URL = 'http://localhost:1337';
const API_TOKEN = '38d79da61a89bf9e65dc1dcac80138a35c542a57832337d0e08bbfa4e4269e6f8ccb2bc1065717d50b29db806272ffec9593dd09c9bb8b13c013e98b687b2ca6f8edde07b57b246a464301e3f0ea63d0b0e6b30b09709ed7f06e1aa39dfd0c54ac632a2fa25f20500acce9d1633cbf2406652154c6f8bb7cf5d5b1c3dd9ce043';
const COLLECTION_NAME = 'bc-datasets';


// Load JSON data from file or use hardcoded data
let jsonData;
try {
  jsonData = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  console.log('📁 Loaded data from data.json file');
} catch (error) {
  console.log('📝 Using hardcoded data (data.json not found)');
}

// Function to make HTTP request
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname,
      method: options.method || 'POST',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to transform data to match Strapi schema
function transformDataForStrapi(data) {
  return data.map(item => ({
    ...item,
    // Convert string account numbers to integers
    G_L_Account_No: parseInt(item.G_L_Account_No, 10),
    // Convert decimal amounts to integers
    Amount: Math.round(item.Amount),
    Debit_Amount: Math.round(item.Debit_Amount),
    Credit_Amount: Math.round(item.Credit_Amount),
    VAT_Amount: Math.round(item.VAT_Amount),
    Additional_Currency_Amount: Math.round(item.Additional_Currency_Amount),
    Add_Currency_Debit_Amount: Math.round(item.Add_Currency_Debit_Amount),
    Add_Currency_Credit_Amount: Math.round(item.Add_Currency_Credit_Amount),
    // Handle empty strings - convert to null for optional fields
    Job_No: item.Job_No || null,
    Business_Unit_Code: item.Business_Unit_Code || null,
    Reason_Code: item.Reason_Code || null,
    Gen_Posting_Type: item.Gen_Posting_Type ? item.Gen_Posting_Type.trim() || null : null,
    Gen_Bus_Posting_Group: item.Gen_Bus_Posting_Group || null,
    Gen_Prod_Posting_Group: item.Gen_Prod_Posting_Group || null,
    Tax_Area_Code: item.Tax_Area_Code || null,
    Tax_Group_Code: item.Tax_Group_Code || null,
    VAT_Bus_Posting_Group: item.VAT_Bus_Posting_Group || null,
    VAT_Prod_Posting_Group: item.VAT_Prod_Posting_Group || null,
    IC_Partner_Code: item.IC_Partner_Code || null
  }));
}

// Function to upload single record to Strapi
async function uploadRecord(record) {
  try {
    const url = `${STRAPI_URL}/api/${COLLECTION_NAME}`;
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    const data = { data: record };
    const response = await makeRequest(url, options, data);
    
    console.log(`✅ Successfully uploaded record ${record.Entry_No}`);
    return response;
  } catch (error) {
    console.error(`❌ Error uploading record ${record.Entry_No}:`, error.message);
    throw error;
  }
}

// Function to upload all records with batch processing
async function uploadAllRecords(records, batchSize = 5) {
  const results = [];
  const errors = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
    
    const batchPromises = batch.map(async (record) => {
      try {
        const result = await uploadRecord(record);
        results.push(result);
        return result;
      } catch (error) {
        errors.push({ record: record.Entry_No, error: error.message });
        return null;
      }
    });

    await Promise.all(batchPromises);
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < records.length) {
      console.log('⏳ Waiting 1 second before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { results, errors };
}

// Main execution function
async function main() {
  try {
    console.log('🚀 Starting data upload to Strapi...');
    console.log(`📊 Total records to upload: ${jsonData.length}`);
    
    // Validate configuration
    if (!API_TOKEN || API_TOKEN === 'your-api-token-here') {
      throw new Error('Please set your API_TOKEN in the configuration');
    }
    
    // Transform data to match Strapi schema
    console.log('🔄 Transforming data...');
    const transformedData = transformDataForStrapi(jsonData);
    
    // Upload records
    console.log('📤 Starting upload...');
    const { results, errors } = await uploadAllRecords(transformedData, 10000); // Increased batch size for faster upload
    
    console.log('\n📈 Upload Summary:');
    console.log(`✅ Successfully uploaded: ${results.length} records`);
    console.log(`❌ Failed uploads: ${errors.length} records`);
    
    if (errors.length > 0) {
      console.log('\n❌ Failed Records (first 10):');
      errors.slice(0, 10).forEach(error => {
        console.log(`  - Entry ${error.record}: ${error.error}`);
      });
      
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }
    
    console.log('\n🎉 Upload process completed!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the upload
main();

// Export functions for use in other scripts
module.exports = {
  transformDataForStrapi,
  uploadRecord,
  uploadAllRecords
};