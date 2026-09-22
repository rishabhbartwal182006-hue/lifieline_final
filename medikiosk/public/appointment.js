/**
 * MediKiosk Appointment Booking System
 * Handles multi-step appointment scheduling, live slot generation,
 * validation, token issuance, and download.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentStep: 1,
    selectedDept: null, // { name, code }
    selectedDate: '',
    selectedTime: null,
    patient: {
      name: '',
      phone: '',
      age: '',
      gender: '',
      abha: '',
      reason: ''
    },
    tokenData: null,
    token: null
  };

  // DOM Elements
  const stepper = document.getElementById('apStepper');
  const panels = {
    1: document.getElementById('panel-1'),
    2: document.getElementById('panel-2'),
    3: document.getElementById('panel-3'),
    4: document.getElementById('panel-4')
  };

  const deptGrid = document.getElementById('deptGrid');
  const toStep2Btn = document.getElementById('toStep2');
  const backTo1Btn = document.getElementById('backTo1');
  const toStep3Btn = document.getElementById('toStep3');
  const backTo2Btn = document.getElementById('backTo2');
  const toStep4Btn = document.getElementById('toStep4');

  const apDateInput = document.getElementById('apDate');
  const slotGrid = document.getElementById('slotGrid');
  const apForm = document.getElementById('apForm');

  // Confirmation Elements
  const tkNumber = document.getElementById('tkNumber');
  const tkNumberSmall = document.getElementById('tkNumberSmall');
  const tkName = document.getElementById('tkName');
  const tkDept = document.getElementById('tkDept');
  const tkDate = document.getElementById('tkDate');
  const tkTime = document.getElementById('tkTime');
  const tkTimeBig = document.getElementById('tkTimeBig');
  const downloadTokenBtn = document.getElementById('downloadToken');
  const bookAnotherBtn = document.getElementById('bookAnother');

  // Available Time Slots Configuration
  const TIME_SLOTS = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM', '05:00 PM'
  ];

  // Initialize Date Input
  const today = new Date();
  const todayStr = formatDateISO(today);
  apDateInput.min = todayStr;
  apDateInput.value = todayStr;
  state.selectedDate = todayStr;

  // Prefill known patient info from Home Care if available
  try {
    const savedName = localStorage.getItem('lifeline_patient_name') || 'Ramesh Kumar';
    const savedAge = localStorage.getItem('lifeline_patient_age') || '68';
    const savedGender = localStorage.getItem('lifeline_patient_gender') || 'Male';

    const fName = document.getElementById('fName');
    const fAge = document.getElementById('fAge');
    const fGender = document.getElementById('fGender');

    if (fName && !fName.value) fName.value = savedName;
    if (fAge && !fAge.value) fAge.value = savedAge;
    if (fGender && !fGender.value) fGender.value = savedGender;
  } catch (e) {
    // Non-blocking localStorage access
  }

  // ===== Stepper Navigation =====
  function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 4) return;
    state.currentStep = stepNumber;

    // Update Panels Visibility
    Object.keys(panels).forEach(key => {
      const k = parseInt(key, 10);
      if (k === stepNumber) {
        panels[k].classList.add('is-active');
      } else {
        panels[k].classList.remove('is-active');
      }
    });

    // Update Stepper Indicators
    if (stepper) {
      const stepItems = stepper.querySelectorAll('.ap-step');
      stepItems.forEach(item => {
        const s = parseInt(item.dataset.step, 10);
        item.classList.remove('is-active', 'is-completed');
        if (s === stepNumber) {
          item.classList.add('is-active');
        } else if (s < stepNumber) {
          item.classList.add('is-completed');
        }
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== Step 1: Department Selection =====
  if (deptGrid) {
    deptGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.ap-dept');
      if (!btn) return;

      deptGrid.querySelectorAll('.ap-dept').forEach(d => d.classList.remove('is-selected'));
      btn.classList.add('is-selected');

      state.selectedDept = {
        name: btn.dataset.dept,
        code: btn.dataset.code || 'GEN'
      };

      if (toStep2Btn) {
        toStep2Btn.disabled = false;
      }
    });
  }

  if (toStep2Btn) {
    toStep2Btn.addEventListener('click', () => {
      if (!state.selectedDept) return;
      renderSlots();
      goToStep(2);
    });
  }

  // ===== Step 2: Date & Time Slots =====
  if (apDateInput) {
    apDateInput.addEventListener('change', () => {
      state.selectedDate = apDateInput.value;
      state.selectedTime = null;
      if (toStep3Btn) toStep3Btn.disabled = true;
      renderSlots();
    });
  }

  function renderSlots() {
    if (!slotGrid) return;
    slotGrid.innerHTML = '';

    const selectedDate = state.selectedDate || apDateInput.value;
    const deptCode = state.selectedDept?.code || 'GEN';

    // Hash date + deptCode to create deterministic booked slots
    const hash = simpleHash(`${selectedDate}-${deptCode}`);

    // Check if selected date is today to disable past slots
    const isToday = selectedDate === todayStr;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    TIME_SLOTS.forEach((slot, index) => {
      const slotBtn = document.createElement('button');
      slotBtn.type = 'button';
      slotBtn.className = 'ap-slot';
      slotBtn.textContent = slot;

      // Determine if booked (simulate ~25% booked rate realistically)
      const isBooked = (hash + index * 7) % 4 === 0;

      // Check if slot has passed today
      const slotMin = parseTimeToMinutes(slot);
      const isPast = isToday && slotMin <= (currentMinutes + 20);

      if (isBooked || isPast) {
        slotBtn.classList.add('is-booked');
        slotBtn.disabled = true;
        slotBtn.title = isPast ? 'Slot already passed' : 'Already booked';
      } else {
        if (state.selectedTime === slot) {
          slotBtn.classList.add('is-selected');
        }

        slotBtn.addEventListener('click', () => {
          slotGrid.querySelectorAll('.ap-slot').forEach(s => s.classList.remove('is-selected'));
          slotBtn.classList.add('is-selected');
          state.selectedTime = slot;
          if (toStep3Btn) toStep3Btn.disabled = false;
        });
      }

      slotGrid.appendChild(slotBtn);
    });
  }

  if (backTo1Btn) {
    backTo1Btn.addEventListener('click', () => goToStep(1));
  }

  if (toStep3Btn) {
    toStep3Btn.addEventListener('click', () => {
      if (!state.selectedTime) return;
      goToStep(3);
    });
  }

  // ===== Step 3: Patient Form & Review =====
  if (backTo2Btn) {
    backTo2Btn.addEventListener('click', () => goToStep(2));
  }

  if (toStep4Btn) {
    toStep4Btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!apForm) return;

      if (!apForm.checkValidity()) {
        apForm.reportValidity();
        return;
      }

      const fPhone = document.getElementById('fPhone');
      if (fPhone && !/^\d{10}$/.test(fPhone.value.trim())) {
        fPhone.setCustomValidity('Please enter a valid 10-digit mobile number');
        fPhone.reportValidity();
        return;
      } else if (fPhone) {
        fPhone.setCustomValidity('');
      }

      // Collect Details
      state.patient = {
        name: document.getElementById('fName')?.value.trim() || 'Patient',
        phone: document.getElementById('fPhone')?.value.trim() || '',
        age: document.getElementById('fAge')?.value.trim() || '',
        gender: document.getElementById('fGender')?.value || '',
        abha: document.getElementById('fAbha')?.value.trim() || '',
        reason: document.getElementById('fReason')?.value.trim() || ''
      };

      // Generate Appointment Token Details
      const tokenNumber = `MK-${state.selectedDept.code}-${Math.floor(1000 + Math.random() * 9000)}`;
      const arrivalTime = calculateArrivalTime(state.selectedTime);
      const formattedDate = formatDisplayDate(state.selectedDate);

      const tokenPayload = {
        tokenNumber,
        number: tokenNumber,
        name: state.patient.name,
        phone: state.patient.phone,
        age: state.patient.age,
        gender: state.patient.gender,
        abha: state.patient.abha,
        reason: state.patient.reason,
        department: state.selectedDept.name,
        dept: state.selectedDept.name,
        date: formattedDate,
        dateLabel: formattedDate,
        rawDate: state.selectedDate,
        slotTime: state.selectedTime,
        arrivalTime: arrivalTime,
        timeLabel: arrivalTime
      };

      state.tokenData = tokenPayload;
      state.token = tokenPayload;

      // Populate Step 4 Confirmation Card (to be shown later if approved)
      if (tkNumber) tkNumber.textContent = tokenNumber;
      if (tkNumberSmall) tkNumberSmall.textContent = tokenNumber;
      if (tkName) tkName.textContent = tokenPayload.name;
      if (tkDept) tkDept.textContent = tokenPayload.department;
      if (tkDate) tkDate.textContent = formattedDate;
      if (tkTime) tkTime.textContent = arrivalTime;
      if (tkTimeBig) tkTimeBig.textContent = arrivalTime;

      // Reset Step 4 views
      document.getElementById('statusPending').style.display = 'block';
      document.getElementById('statusApproved').style.display = 'none';
      document.getElementById('statusRejected').style.display = 'none';

      goToStep(4);

      try {
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientName: state.patient.name,
            age: state.patient.age,
            gender: state.patient.gender,
            phone: state.patient.phone,
            symptoms: state.patient.reason,
            department: state.selectedDept.name,
            requestedDate: state.selectedDate,
            requestedTime: state.selectedTime,
            arrivalTime: arrivalTime,
            tokenNumber: tokenNumber
          })
        });
        const createdAppt = await res.json();
        
        // Start polling
        startPolling(createdAppt._id);
        
      } catch (err) {
        console.error('Failed to create appointment', err);
        alert('Failed to send appointment request. Please try again.');
        goToStep(3);
      }
    });
  }
  
  function startPolling(id) {
    if (state.pollInterval) clearInterval(state.pollInterval);
    state.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/appointments/${id}`);
        if (!res.ok) return;
        const appt = await res.json();
        
        if (appt.status === 'approved') {
          clearInterval(state.pollInterval);
          document.getElementById('statusPending').style.display = 'none';
          document.getElementById('statusApproved').style.display = 'block';
          saveAppointmentToStorage(state.tokenData);
        } else if (appt.status === 'rejected') {
          clearInterval(state.pollInterval);
          document.getElementById('statusPending').style.display = 'none';
          document.getElementById('statusRejected').style.display = 'block';
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 2000); // poll every 2s
  }

  const rebookBtn = document.getElementById('rebookBtn');
  if (rebookBtn) {
    rebookBtn.addEventListener('click', () => {
      goToStep(2); // Go back to time selection
    });
  }

  // ===== Download token as a PNG image (pure canvas, no external libraries) =====
  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
    ctx.lineTo(x + r.bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.arcTo(x, y, x + r.tl, y, r.tl);
    ctx.closePath();
  }

  async function downloadTokenImage() {
    const token = state.token || state.tokenData;
    if (!token) return;
    const number = token.number || token.tokenNumber || 'TOKEN';
    const dateLabel = token.dateLabel || token.date || '';
    const timeLabel = token.timeLabel || token.arrivalTime || '';
    const name = token.name || 'Patient';
    const dept = token.dept || token.department || 'General Medicine';

    // best-effort wait for the web fonts so the canvas text matches the on-screen card
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) { /* ignore */ }
    }

    const margin = 20;
    const cardW = 840, headerH = 340, perfH = 40, slipH = 320;
    const cardH = headerH + perfH + slipH;

    const canvas = document.createElement("canvas");
    canvas.width = cardW + margin * 2;
    canvas.height = cardH + margin * 2;
    const ctx = canvas.getContext("2d");

    const cardX = margin, cardY = margin;

    // page background
    ctx.fillStyle = "#f6f8fa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // header (gradient)
    roundedRectPath(ctx, cardX, cardY, cardW, headerH, { tl: 32, tr: 32, br: 0, bl: 0 });
    const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
    grad.addColorStop(0, "#1c4f85");
    grad.addColorStop(1, "#2563a6");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "600 13px Inter, sans-serif";
    ctx.fillText("MEDIKIOSK APPOINTMENT TOKEN", cardX + 48, cardY + 62);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 42px 'JetBrains Mono', monospace";
    ctx.fillText(number, cardX + 48, cardY + 138);

    const gridItems = [
      ["PATIENT", name, cardX + 48, cardY + 206],
      ["DEPARTMENT", dept, cardX + 444, cardY + 206],
      ["DATE", dateLabel, cardX + 48, cardY + 286],
      ["ARRIVAL TIME", timeLabel, cardX + 444, cardY + 286],
    ];
    gridItems.forEach(([label, value, x, y]) => {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "600 11px Inter, sans-serif";
      ctx.fillText(label, x, y);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 20px Inter, sans-serif";
      ctx.fillText(value, x, y + 28);
    });

    // slip (bottom section)
    roundedRectPath(ctx, cardX, cardY + headerH + perfH, cardW, slipH, { tl: 0, tr: 0, br: 32, bl: 32 });
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // perforation
    const perfY = cardY + headerH + perfH / 2;
    ctx.strokeStyle = "rgba(16,27,45,0.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(cardX, perfY);
    ctx.lineTo(cardX + cardW, perfY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#f6f8fa";
    ctx.beginPath(); ctx.arc(cardX, perfY, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cardX + cardW, perfY, 20, 0, Math.PI * 2); ctx.fill();

    // slip text
    ctx.textAlign = "center";
    ctx.fillStyle = "#7c899b";
    ctx.font = "600 13px Inter, sans-serif";
    ctx.fillText("PLEASE ARRIVE BY", cardX + cardW / 2, cardY + headerH + perfH + 70);

    ctx.fillStyle = "#101b2d";
    ctx.font = "700 58px Sora, sans-serif";
    ctx.fillText(timeLabel, cardX + cardW / 2, cardY + headerH + perfH + 150);

    ctx.fillStyle = "#7c899b";
    ctx.font = "500 15px Inter, sans-serif";
    ctx.fillText(`Token ${number}`, cardX + cardW / 2, cardY + headerH + perfH + 210);
    ctx.textAlign = "left";

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  if (downloadTokenBtn) {
    downloadTokenBtn.addEventListener("click", downloadTokenImage);
  }

  if (bookAnotherBtn) {
    bookAnotherBtn.addEventListener('click', () => {
      // Reset State
      state.selectedDept = null;
      state.selectedTime = null;
      state.tokenData = null;
      state.token = null;

      if (toStep2Btn) toStep2Btn.disabled = true;
      if (toStep3Btn) toStep3Btn.disabled = true;

      deptGrid?.querySelectorAll('.ap-dept').forEach(d => d.classList.remove('is-selected'));
      apForm?.reset();

      goToStep(1);
    });
  }

  // ===== Helper Functions =====

  function calculateArrivalTime(timeStr) {
    if (!timeStr) return '—';
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return timeStr;

    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);
    const meridian = match[3].toUpperCase();

    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    let totalMinutes = hours * 60 + minutes - 15;
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const arrHours = Math.floor(totalMinutes / 60);
    const arrMinutes = totalMinutes % 60;
    const arrMeridian = arrHours >= 12 ? 'PM' : 'AM';

    let displayHours = arrHours % 12;
    if (displayHours === 0) displayHours = 12;

    return `${String(displayHours).padStart(2, '0')}:${String(arrMinutes).padStart(2, '0')} ${arrMeridian}`;
  }

  function parseTimeToMinutes(timeStr) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3].toUpperCase();
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function saveAppointmentToStorage(appt) {
    try {
      const list = JSON.parse(localStorage.getItem('medikiosk_appointments') || '[]');
      list.unshift(appt);
      localStorage.setItem('medikiosk_appointments', JSON.stringify(list.slice(0, 10)));
    } catch (e) {
      // Non-blocking storage error
    }
  }
});