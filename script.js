function formatCurrency(value) {
  if (isNaN(value) || value === null) return "";
  // Return just the number with commas, no '$' prefix
  // The prefix is now handled by the HTML structure
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function formatPercent(value) {
if (isNaN(value) || value === null) return "";
return value.toFixed(2) + "%";
}
function parseNumber(input) {
if (!input) return null;
var value = parseFloat(String(input).replace(/[^0-9.\-]/g, ""));
if (isNaN(value)) return null;
return value;
}
function setMessage(text, isSuccess) {
var el = document.getElementById("message");
if (!el) return;
el.textContent = text || "";
el.classList.remove("success");
if (text && isSuccess) {
el.classList.add("success");
}
}
function updateCurrentAnnual() {
var currentMonthlyInput = document.getElementById("currentMonthlyBenefit");
var currentAnnualOutput = document.getElementById("currentAnnualBenefit");
if (!currentMonthlyInput || !currentAnnualOutput) return;
var currentMonthly = parseNumber(currentMonthlyInput.value);
if (currentMonthly === null || currentMonthly <= 0) {
currentAnnualOutput.value = "";
return;
}
var currentAnnual = currentMonthly * 12;
currentAnnualOutput.value = formatCurrency(currentAnnual);
}
function parseDate(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  // Year, Month (0-indexed), Day
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function calculate() {
  setMessage("");
  var currentMonthlyInput = document.getElementById("currentMonthlyBenefit");
  var currentAnnualOutput = document.getElementById("currentAnnualBenefit");
  var colaPercentInput = document.getElementById("colaPercent");
  var colaCurrentMonthlyInput = document.getElementById("colaCurrentMonthly");
  var colaMonthlyOutput = document.getElementById("colaMonthlyBenefit");
  var colaAnnualOutput = document.getElementById("colaAnnualBenefit");
  var totalAnnualOutput = document.getElementById("totalAnnualBenefit");
  var effectiveDateInput = document.getElementById("effectiveDate");
  var colaEffectiveDateInput = document.getElementById("colaEffectiveDate");
  var breakdownContainer = document.getElementById("breakdownContainer");

  var currentMonthly = parseNumber(currentMonthlyInput.value);

  if (currentMonthly === null || currentMonthly <= 0) {
    currentAnnualOutput.value = "";
    colaMonthlyOutput.value = "";
    colaAnnualOutput.value = "";
    totalAnnualOutput.value = "";
    if (breakdownContainer) breakdownContainer.innerHTML = "";
    // Don't show error message during live typing, just clear
    return;
  }

  // Check if effective date is required but missing
  // We only strictly require it for the SPLIT calculation, but the user asked for it to be a "Requirement".
  // If it's missing, should we stop calculation or just the total?
  // Let's assume we proceed with basic calc but warn or leave Total empty?
  // Usually "Required" means the form is invalid without it.
  // But for live calculation, blocking everything feels broken.
  // However, since the prompt says "must be a requirement", let's make sure
  // we at least highlight it or don't show the TOTAL if it's missing.
  
  // For now, let's proceed but if effectiveDate is missing, totalAnnual is just 0 or empty?
  var effectiveDate = parseDate(effectiveDateInput.value);
  
  // Date validation for Social Security Letter
  var ssLetterDateInput = document.getElementById("ssLetterDate");
  var ssDateWarning = document.getElementById("ssDateWarning");
  if (ssLetterDateInput) {
    ssLetterDateInput.classList.remove("invalid-date");
    if (effectiveDate && ssLetterDateInput.value) {
      var ssLetterDate = parseDate(ssLetterDateInput.value);
      if (ssLetterDate) {
        var diffTime = effectiveDate.getTime() - ssLetterDate.getTime();
        var diffDays = diffTime / (1000 * 3600 * 24);
        if (diffDays > 120 || diffDays < 0) {
          ssLetterDateInput.classList.add("invalid-date");
          if (ssDateWarning) ssDateWarning.style.display = "block";
        } else {
          if (ssDateWarning) ssDateWarning.style.display = "none";
        }
      }
    } else {
      if (ssDateWarning) ssDateWarning.style.display = "none";
    }
  }

  if (!effectiveDate) {
     // If effective date is missing, we can calculate the top parts (current/cola) 
     // but the TOTAL depends on the start date (Move In Date).
     // If we treat it as strictly required, we shouldn't show the Total.
     // Let's calculate the parts but blank out the Total.
  }

  // Basic x12 calculation for the top box
  var currentAnnual = currentMonthly * 12;
  currentAnnualOutput.value = formatCurrency(currentAnnual);

  // COLA Inputs
  var colaPercent = parseNumber(colaPercentInput.value);
  var colaMonthlyBase = parseNumber(colaCurrentMonthlyInput.value);

  // Auto-fill COLA base if empty (only for calculation purposes, don't fill input while typing)
  // actually, we might want to respect the input if it's there, otherwise use currentMonthly
  var effectiveColaBase = colaMonthlyBase;
  if (effectiveColaBase === null) {
    effectiveColaBase = currentMonthly;
  }

  var hasCola = colaPercent !== null && colaPercent > 0;
  var colaMonthly = null;
  var colaAnnual = null;

  if (hasCola) {
    colaMonthly = effectiveColaBase * (1 + colaPercent / 100);
    colaAnnual = colaMonthly * 12;
    colaMonthlyOutput.value = formatCurrency(colaMonthly);
    colaAnnualOutput.value = formatCurrency(colaAnnual);
  } else {
    // If user deleted COLA % or it is 0, we should clear these
    // UNLESS the user is in the middle of typing? 
    // Actually, if COLA % is invalid/empty, we can't calculate a COLA benefit.
    colaMonthlyOutput.value = "";
    colaAnnualOutput.value = "";
  }

  // --- TOTAL ANNUAL CALCULATION (Split Logic) ---
  var totalAnnual = 0;
  // effectiveDate is already parsed above
  var colaEffectiveDate = parseDate(colaEffectiveDateInput.value);
  
  // If effectiveDate is missing, we cannot calculate the Total Annual Benefit correctly
  // because we don't know when the benefit starts (12 month loop depends on it).
  if (!effectiveDate) {
    totalAnnualOutput.value = "";
    if (breakdownContainer) breakdownContainer.innerHTML = "";
    return;
  }

  // Counters for breakdown
  var monthsCurrentCount = 0;
  var monthsColaCount = 0;

  // If we have both dates and a COLA, do the split calculation
  if (colaEffectiveDate && hasCola) {
    // Loop 12 months starting from effectiveDate
    for (var i = 0; i < 12; i++) {
      // Calculate the start of the current month in the loop
      // We use the 1st of the month for comparison to be safe
      var loopMonth = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth() + i, 1);
      
      // Compare with COLA date (also normalized to 1st of month just in case, 
      // though usually input is YYYY-MM-DD)
      var compareColaDate = new Date(colaEffectiveDate.getFullYear(), colaEffectiveDate.getMonth(), 1);

      if (loopMonth >= compareColaDate) {
        totalAnnual += colaMonthly;
        monthsColaCount++;
      } else {
        totalAnnual += currentMonthly;
        monthsCurrentCount++;
      }
    }
  } else if (hasCola) {
    // If COLA exists but COLA date is missing, we default to standard calculation (12 * current)
    // as we cannot determine when COLA starts.
    totalAnnual = currentMonthly * 12;
    monthsCurrentCount = 12;
  } else {
    // No COLA, just 12 months of current benefit
    totalAnnual = currentAnnual;
    monthsCurrentCount = 12;
  }

  totalAnnualOutput.value = formatCurrency(totalAnnual);

  // Render breakdown
  if (breakdownContainer) {
    var html = "";
    // Only show if we have a valid total
    if (totalAnnual > 0) {
        if (monthsCurrentCount > 0) {
            var subTotal = monthsCurrentCount * currentMonthly;
            html += '<div class="breakdown-item"><span>$' + formatCurrency(currentMonthly) + ' &times; ' + monthsCurrentCount + ' months</span> <span>$' + formatCurrency(subTotal) + '</span></div>';
        }
        if (monthsColaCount > 0) {
            var subTotal = monthsColaCount * colaMonthly;
            html += '<div class="breakdown-item"><span>$' + formatCurrency(colaMonthly) + ' (COLA) &times; ' + monthsColaCount + ' months</span> <span>$' + formatCurrency(subTotal) + '</span></div>';
        }
        // Total line
        // html += '<div class="breakdown-item"><span>Total</span> <span>$' + formatCurrency(totalAnnual) + '</span></div>';
    }
    breakdownContainer.innerHTML = html;
  }
}

function formatDateMMDDYYYY(date) {
  if (!date) return "";
  var m = (date.getMonth() + 1).toString().padStart(2, '0');
  var d = date.getDate().toString().padStart(2, '0');
  var y = date.getFullYear();
  return m + "/" + d + "/" + y;
}

function calculateEmployment() {
  var totalEmploymentOutput = document.getElementById("totalEmploymentIncome");
  var avgGrossOutput = document.getElementById("avgGrossPay");
  var empBreakdownContainer = document.getElementById("empBreakdownContainer");
  var payFrequencyInput = document.getElementById("payFrequency");
  var effectiveDateInput = document.getElementById("empEffectiveDate");
  var dateWarning = document.getElementById("dateWarning");
  
  var stubInputs = [];
  var dateInputs = [];
  var payStubCountSelect = document.getElementById("payStubCount");
  var maxStubs = payStubCountSelect ? parseInt(payStubCountSelect.value, 10) : 4;

  for (var i = 1; i <= 6; i++) {
    var grossInput = document.getElementById("grossPay" + i);
    var dateInput = document.getElementById("payDate" + i);
    var stubRow = document.getElementById("stubRow" + i);

    if (stubRow) {
      if (i <= maxStubs) {
        stubRow.style.display = "grid";
        if (grossInput) stubInputs.push(grossInput);
        if (dateInput) dateInputs.push(dateInput);
      } else {
        stubRow.style.display = "none";
        // Clear hidden inputs to avoid confusion in calculation
        if (grossInput) grossInput.value = "";
        if (dateInput) dateInput.value = "";
      }
    }
  }

  var totalGross = 0;
  var stubCount = 0;
  var hasOutdatedDate = false;
  var effectiveDate = parseDate(effectiveDateInput ? effectiveDateInput.value : "");
  var validStubs = [];

  stubInputs.forEach(function(input, index) {
    if (input) {
      // Clear previous highlighting
      if (dateInputs[index]) dateInputs[index].classList.remove("invalid-date");
      
      var val = parseNumber(input.value);
      if (val !== null && val > 0) {
        totalGross += val;
        stubCount++;
        
        var stubDate = null;
        if (dateInputs[index] && dateInputs[index].value) {
          stubDate = parseDate(dateInputs[index].value);
        }

        validStubs.push({
          amount: val,
          date: stubDate
        });
        
        // Date validation logic
        if (effectiveDate && stubDate) {
          var diffTime = effectiveDate.getTime() - stubDate.getTime();
          var diffDays = diffTime / (1000 * 3600 * 24);
          if (diffDays > 120 || diffDays < 0) {
            hasOutdatedDate = true;
            dateInputs[index].classList.add("invalid-date");
          }
        }
      }
    }
  });

  // Show/hide date warning
  if (dateWarning) {
    dateWarning.style.display = hasOutdatedDate ? "block" : "none";
  }

  var frequency = parseInt(payFrequencyInput.value, 10);

  if (stubCount === 0) {
    if (avgGrossOutput) avgGrossOutput.value = "";
    totalEmploymentOutput.value = "";
    if (empBreakdownContainer) empBreakdownContainer.innerHTML = "";
    return;
  }

  // Calculate average per stub
  var averageGross = totalGross / stubCount;
  if (avgGrossOutput) avgGrossOutput.value = formatCurrency(averageGross);
  
  // Calculate annual income
  var totalAnnual = averageGross * frequency;
  totalEmploymentOutput.value = formatCurrency(totalAnnual);

  // Debug log to check if calculation reaches this point
  console.log("Employment calculation:", {
    totalGross,
    stubCount,
    averageGross,
    frequency,
    totalAnnual
  });

  // Show breakdown
  if (empBreakdownContainer) {
    var frequencyText = payFrequencyInput.options[payFrequencyInput.selectedIndex].text.split(" ")[0];
    var stubsHtml = validStubs.map(function(stub, idx) {
      var dateStr = stub.date ? ` (${formatDateMMDDYYYY(stub.date)})` : "";
      return `
        <div class="breakdown-item">
          <span>Stub ${idx + 1} Amount${dateStr}:</span>
          <span>$${formatCurrency(stub.amount)}</span>
        </div>
      `;
    }).join("");

    empBreakdownContainer.innerHTML = `
      <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem;">Pay Stub Breakdown</div>
      ${stubsHtml}
      <div style="margin-top: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
        <div class="breakdown-item">
          <span>Average Gross Pay:</span>
          <span>$${formatCurrency(averageGross)}</span>
        </div>
        <div class="breakdown-item">
          <span>Pay Frequency:</span>
          <span>${frequency} (${frequencyText})</span>
        </div>
        <div class="breakdown-item">
          <span>Calculation:</span>
          <span>$${formatCurrency(averageGross)} × ${frequency} = $${formatCurrency(totalAnnual)}</span>
        </div>
      </div>
    `;
    // Ensure the container is visible
    empBreakdownContainer.style.display = "block";
  }
}

function resetForm() {
  var inputs = document.querySelectorAll("input, select");
  inputs.forEach(function (input) {
    if (input.type === "button" || input.type === "submit") return;
    if (input.tagName === "SELECT") {
      input.selectedIndex = 0;
    } else {
      input.value = "";
    }
  });
  setMessage("");
  
  // Clear breakdowns
  var breakdownContainer = document.getElementById("breakdownContainer");
  if (breakdownContainer) breakdownContainer.innerHTML = "";
  var empBreakdownContainer = document.getElementById("empBreakdownContainer");
  if (empBreakdownContainer) empBreakdownContainer.innerHTML = "";

  // Clear warnings
  var dateWarning = document.getElementById("dateWarning");
  if (dateWarning) dateWarning.style.display = "none";
  var ssDateWarning = document.getElementById("ssDateWarning");
  if (ssDateWarning) ssDateWarning.style.display = "none";
  
  // Clear date highlights
  var dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(function(input) {
    input.classList.remove("invalid-date");
  });

  // Focus the name field of the active section
  var activeSection = document.querySelector(".calculator-section.active");
  if (activeSection) {
    var firstInput = activeSection.querySelector("input[type='text']");
    if (firstInput) firstInput.focus();
  }
}

function printPage() {
  window.print();
}

function downloadPDF() {
  var element = document.querySelector(".calculator-section.active");
  var activeTab = document.querySelector(".tab-btn.active");
  var tabName = activeTab ? activeTab.textContent : "Calculator";
  
  // Get member name from active section
  var nameInput = element.querySelector("input[autocomplete='name']");
  var memberName = (nameInput && nameInput.value) ? nameInput.value : "Member";
  
  var filename = tabName.replace(/\s+/g, "_") + "_" + memberName.replace(/\s+/g, "_") + ".pdf";

  var opt = {
    margin: [0.3, 0.3, 0.3, 0.3],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      letterRendering: true,
      scrollY: 0
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  // Temporarily adjust styles for PDF generation
  element.style.padding = "0.1in";
  element.style.background = "white";
  
  html2pdf().set(opt).from(element).save().then(function() {
    element.style.padding = "";
    element.style.background = "";
  });
}

function autoFillColaBase() {
  var currentMonthlyInput = document.getElementById("currentMonthlyBenefit");
  var colaCurrentMonthlyInput = document.getElementById("colaCurrentMonthly");
  if (!currentMonthlyInput || !colaCurrentMonthlyInput) return;
  var currentMonthly = parseNumber(currentMonthlyInput.value);
  if (currentMonthly === null || currentMonthly <= 0) return;
  if (!colaCurrentMonthlyInput.value) {
    colaCurrentMonthlyInput.value = currentMonthly.toFixed(2);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var resetButton = document.getElementById("resetButton");
  var printButton = document.getElementById("printButton");
  var downloadPdfButton = document.getElementById("downloadPdfButton");
  if (resetButton) resetButton.addEventListener("click", resetForm);
  if (printButton) printButton.addEventListener("click", printPage);
  if (downloadPdfButton) downloadPdfButton.addEventListener("click", downloadPDF);

  // Tab switching logic
  var tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(function(btn) {
    btn.addEventListener("click", function() {
      var targetId = this.getAttribute("data-target");
      
      // Update buttons
      tabButtons.forEach(function(b) { b.classList.remove("active"); });
      this.classList.add("active");
      
      // Update sections
      var sections = document.querySelectorAll(".calculator-section");
      sections.forEach(function(s) { s.classList.remove("active"); });
      var targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.classList.add("active");
    });
  });

  // Social Security Inputs that trigger calculation
  var ssCalcInputs = [
    "currentMonthlyBenefit",
    "colaPercent",
    "colaCurrentMonthly",
    "effectiveDate",
    "colaEffectiveDate",
    "ssLetterDate"
  ];

  ssCalcInputs.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", calculate);
      if (el.type === "date") {
        el.addEventListener("change", calculate);
      }
    }
  });

  // Employment Inputs that trigger calculation
  var empCalcInputs = [
    "empEffectiveDate",
    "grossPay1", "payDate1",
    "grossPay2", "payDate2",
    "grossPay3", "payDate3",
    "grossPay4", "payDate4",
    "grossPay5", "payDate5",
    "grossPay6", "payDate6",
    "payFrequency",
    "payStubCount"
  ];
  empCalcInputs.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.tagName === "SELECT" || el.type === "date") {
        el.addEventListener("change", calculateEmployment);
      } else {
        el.addEventListener("input", calculateEmployment);
      }
    }
  });

  var currentMonthlyInput = document.getElementById("currentMonthlyBenefit");
  if (currentMonthlyInput) {
    currentMonthlyInput.addEventListener("blur", autoFillColaBase);
  }

  // Initialize Pay Stubs visibility on load
  calculateEmployment();
});
