/**
 * Dashboard Google Apps Script Backend
 * Fixed version
 */

const SPREADSHEET_ID = "1sRl7IlEBVzuVHYGYU_wy9A3A70H5y35eBwwl-pg4vhE";
const SHEET_NAME = "Youcan-Orders";

/**
 * Normalize header string: remove invisible characters and extra spaces
 */
function normalizeHeader(h) {
  var str = h.toString();
  // Remove zero-width space (U+200B), ZW non-joiner (U+200C), ZW joiner (U+200D), BOM (U+FEFF), non-breaking space (U+00A0)
  str = str.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, ' ');
  // Collapse multiple spaces and trim
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

/**
 * Serves the HTML dashboard page
 * Routes to mobile.html for small screens, index.html for desktop
 */
function doGet(e) {
  var view = e && e.parameter && e.parameter.view ? e.parameter.view : '';
  var file = view === 'mobile' ? 'mobile' : 'index';
  return HtmlService.createHtmlOutputFromFile(file)
      .setTitle('لوحة تحكم المراقبة | Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

/**
 * Fetches all sheet names and data from the active or specified sheet tab.
 * FIX: sheetsList now returns ALL sheets in the spreadsheet, not just the current one.
 *
 * @param {string} [sheetName] Optional sheet name to query
 * @return {object} Spreadsheet metadata and array of row objects
 */
function getSheetData(sheetName) {
  // FIX: Use default parameter safely (Apps Script doesn't always support ES6 defaults in all versions)
  if (!sheetName) sheetName = SHEET_NAME;

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet tab "' + sheetName + '" not found.');
    }

    // FIX: Return all sheet names in the spreadsheet
    var allSheets = ss.getSheets().map(function(s) { return s.getName(); });

    var range = sheet.getDataRange();
    var data = range.getValues();

    if (data.length === 0) {
      return {
        success: true,
        spreadsheetName: ss.getName(),
        sheetName: sheet.getName(),
        sheetsList: allSheets,
        headers: [],
        rows: []
      };
    }

    var rawHeaders = data[0];
    // Normalize headers: remove invisible characters (zero-width spaces, non-breaking spaces)
    var headers = rawHeaders.map(function(h) { return normalizeHeader(h); });
    var rows = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Skip completely empty rows
      var isEmpty = row.every(function(cell) { return cell === '' || cell === null || cell === undefined; });
      if (isEmpty) continue;

      // _rowNum is 1-based sheet row index (row 1 = headers, row 2 = first data row → i+1)
      var rowObj = { _rowNum: i + 1 };

      headers.forEach(function(header, index) {
        if (header !== '') {
          var cellValue = row[index];

          // Format Date objects as ISO date strings
          // FIX: getSpreadsheetTimeZone() can return null in some locales — fall back to 'GMT'
          if (cellValue instanceof Date) {
            var tz = ss.getSpreadsheetTimeZone();
            if (!tz || typeof tz !== 'string' || tz.trim() === '') tz = 'GMT';
            cellValue = Utilities.formatDate(cellValue, tz, 'yyyy-MM-dd');
          }

          rowObj[header] = cellValue;
        }
      });

      rows.push(rowObj);
    }

    return {
      success: true,
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      sheetsList: allSheets,
      headers: headers,
      rows: rows
    };

  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Saves a generic row (add or edit) to any sheet.
 * For add: rowNum = null
 * For edit: rowNum = 1-based row index
 *
 * @param {string} sheetName
 * @param {number|null} rowNum
 * @param {object} values Key-value pairs of column → value
 * @return {object}
 */
function saveGenericRow(sheetName, rowNum, values) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet tab "' + sheetName + '" not found.');
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return normalizeHeader(h);
    });

    // Numeric columns
    var numericColumns = [
      'Variant price', 'Total quantity', 'Total price',
      "prix d'achat", 'Frais livraison', 'Bénéfice',
      'Fourni price', 'nombre', 'Prix Unit', 'total', 'Payment',
      'Prix de vente', 'Prix'
    ];

    if (rowNum && rowNum >= 2) {
      // EDIT mode: update existing row
      for (var key in values) {
        if (!values.hasOwnProperty(key)) continue;
        var colIndex = headers.indexOf(key);
        if (colIndex === -1) continue;

        var valueToSet = values[key];
        if (numericColumns.indexOf(key) !== -1) {
          var parsed = parseFloat(valueToSet);
          if (!isNaN(parsed)) valueToSet = parsed;
        }
        sheet.getRange(rowNum, colIndex + 1).setValue(valueToSet);
      }
    } else {
      // ADD mode: append new row
      var newRow = headers.map(function(h) {
        var val = values[h];
        if (val === undefined || val === null) val = '';
        if (numericColumns.indexOf(h) !== -1) {
          var parsed = parseFloat(val);
          if (!isNaN(parsed)) val = parsed;
        }
        return val;
      });
      sheet.appendRow(newRow);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Updates specific columns for a row in the Google Sheet.
 * FIX: Uses var instead of let/const for broader Apps Script compatibility.
 * FIX: Improved numeric detection — only converts fields that are known numeric columns.
 *
 * @param {string} sheetName  Name of the sheet tab
 * @param {number} rowNum     1-based row index in the sheet
 * @param {object} updates    Key-value pairs of column header → new value
 * @return {object} Success status or error details
 */
function updateOrderRow(sheetName, rowNum, updates) {
  if (!sheetName) sheetName = SHEET_NAME;

  // FIX: Validate rowNum to prevent accidental header row overwrites
  if (!rowNum || rowNum < 2) {
    return { success: false, error: 'Invalid rowNum: must be >= 2 (row 1 is headers).' };
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet tab "' + sheetName + '" not found.');
    }

    // Read only the header row
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return normalizeHeader(h);
    });

    // Columns that should to be stored as numbers
    var numericColumns = [
      'Variant price', 'Total quantity', 'Total price',
      'prix d\'achat', 'Frais livraison', 'Bénéfice',
      'Fourni price', 'nombre', 'Prix Unit', 'total',
      'Prix de vente', 'Prix'
    ];

    var updatedCount = 0;

    for (var key in updates) {
      if (!updates.hasOwnProperty(key)) continue;

      var colIndex = headers.indexOf(key);
      if (colIndex === -1) {
        Logger.log('Column "' + key + '" not found in sheet headers — skipping.');
        continue;
      }

      var valueToSet = updates[key];

      // Convert to number only for known numeric columns
      if (numericColumns.indexOf(key) !== -1) {
        var parsed = parseFloat(valueToSet);
        if (!isNaN(parsed)) {
          valueToSet = parsed;
        }
      }

      sheet.getRange(rowNum, colIndex + 1).setValue(valueToSet);
      updatedCount++;
    }

    return {
      success: true,
      updatedColumns: updatedCount
    };

  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}