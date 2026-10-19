(() => {
  "use strict";

  const jsonRequest = async (url, payload) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new Error(body.message || "Request failed.");
    }
    return body;
  };

  const stopStream = (video) => {
    if (!video || !video.srcObject) return;
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  const startStream = async (video, button, status) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("This browser does not support camera access.");
    }
    stopStream(video);
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    await video.play();
    button.disabled = false;
    status.textContent = "Camera ready.";
  };

  const capture = (video, canvas) => {
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Camera is not ready yet.");
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const setStatus = (element, message, isError = false) => {
    element.textContent = message;
    element.style.color = isError ? "var(--red)" : "";
  };

  const setupTimeGreeting = () => {
    const greeting = document.querySelector("#time-greeting");
    if (!greeting) return;
    const updateGreeting = () => {
      const hour = new Date().getHours();
      const period = hour >= 5 && hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : hour < 21
            ? "Good evening"
            : "Good night";
      greeting.textContent = `${period}.`;
    };
    updateGreeting();
    window.setInterval(updateGreeting, 60000);
  };

  const setupHeaderBehavior = () => {
    const header = document.querySelector(".dashboard-header");
    if (!header) return;

    let lastScrollY = window.scrollY;
    let hideTimer = 0;
    let scrollFrame = 0;
    const showHeader = () => {
      window.clearTimeout(hideTimer);
      header.classList.remove("header-hidden");
    };
    const scheduleHide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (window.scrollY > 80) header.classList.add("header-hidden");
      }, 1400);
    };
    const handleScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY <= 80 || currentScrollY < lastScrollY) {
          showHeader();
        } else if (currentScrollY > lastScrollY) {
          scheduleHide();
        }
        lastScrollY = currentScrollY;
        scrollFrame = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scrollend", handleScroll, { passive: true });
    ["mouseenter", "focusin", "pointerdown"].forEach((eventName) => {
      header.addEventListener(eventName, showHeader, { passive: true });
    });
  };

  const setupMobileNavigation = () => {
    const menuButton = document.querySelector(".infy-menu");
    const menu = document.querySelector("#mobile-navigation");
    if (!menuButton || !menu) return;
    const closeButton = menu.querySelector(".mobile-menu-close");
    if (!closeButton) return;

    const closeMenu = () => {
      menuButton.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
      menu.classList.remove("is-open");
      document.body.classList.remove("mobile-menu-open");
    };

    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menu.setAttribute("aria-hidden", String(isOpen));
      menu.classList.toggle("is-open", !isOpen);
      document.body.classList.toggle("mobile-menu-open", !isOpen);
    });

    closeButton.addEventListener("click", closeMenu);
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
  };

  const setupStudentCapture = () => {
    const video = document.querySelector("#camera");
    if (!video) return;
    const canvas = document.querySelector("#snapshot");
    const preview = document.querySelector("#photo-preview");
    const rollInput = document.querySelector("#face-roll");
    const startButton = document.querySelector("#start-camera");
    const captureButton = document.querySelector("#take-photo");
    const retakeButton = document.querySelector("#retake-photo");
    const saveButton = document.querySelector("#save-photo");
    const status = document.querySelector("#camera-status");
    let imageData = "";

    startButton.addEventListener("click", async () => {
      try {
        await startStream(video, captureButton, status);
        setStatus(status, "Camera ready. Capture a clear, front-facing photo.");
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });

    captureButton.addEventListener("click", () => {
      try {
        imageData = capture(video, canvas);
        preview.src = imageData;
        preview.hidden = false;
        retakeButton.disabled = false;
        saveButton.disabled = false;
        setStatus(status, "Photo captured. Confirm the roll number and save.");
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });

    retakeButton.addEventListener("click", () => {
      imageData = "";
      preview.removeAttribute("src");
      preview.hidden = true;
      saveButton.disabled = true;
      setStatus(status, "Ready to capture another photo.");
    });

    saveButton.addEventListener("click", async () => {
      if (!rollInput.value.trim() || !imageData) {
        setStatus(status, "Enter a roll number and capture a photo first.", true);
        return;
      }
      saveButton.disabled = true;
      try {
        const result = await jsonRequest("/students/capture-face", {
          roll_number: rollInput.value.trim(),
          face_image: imageData,
        });
        setStatus(status, result.message);
        imageData = "";
        preview.removeAttribute("src");
        preview.hidden = true;
      } catch (error) {
        setStatus(status, error.message, true);
      } finally {
        saveButton.disabled = false;
      }
    });

    window.addEventListener("beforeunload", () => stopStream(video));
  };

  const setupAttendanceCapture = () => {
    const video = document.querySelector("#attendance-camera");
    if (!video) return;
    const canvas = document.querySelector("#attendance-canvas");
    const startButton = document.querySelector("#attendance-start");
    const captureButton = document.querySelector("#attendance-capture");
    const stopButton = document.querySelector("#attendance-stop");
    const status = document.querySelector("#attendance-status");

    startButton.addEventListener("click", async () => {
      try {
        await startStream(video, captureButton, status);
        stopButton.disabled = false;
        setStatus(status, "Camera ready. Look at the camera and recognize.");
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });

    stopButton.addEventListener("click", () => {
      stopStream(video);
      captureButton.disabled = true;
      stopButton.disabled = true;
      setStatus(status, "Camera stopped.");
    });

    captureButton.addEventListener("click", async () => {
      captureButton.disabled = true;
      try {
        const result = await jsonRequest("/attendance/recognize", {
          face_image: capture(video, canvas),
        });
        setStatus(status, result.message);
      } catch (error) {
        setStatus(status, error.message, true);
      } finally {
        captureButton.disabled = false;
      }
    });

    window.addEventListener("beforeunload", () => stopStream(video));
  };

  const setupStudentSearch = () => {
    const search = document.querySelector("#student-search");
    const rows = document.querySelectorAll("#students-table tbody tr");
    if (!search || !rows.length) return;

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      rows.forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    });
  };

  const setupLiveStats = () => {
    const stats = document.querySelectorAll(".stat-card h2");
    if (stats.length < 2) return;
    window.setInterval(async () => {
      try {
        const response = await fetch("/api/dashboard-stats", {
          headers: { "Accept": "application/json" },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success) return;
        stats[0].textContent = data.total_students;
        stats[1].textContent = data.today_count;
        stats[2].textContent = data.face_count;
        stats[3].textContent = data.model_ready ? "Ready" : "Train";
      } catch (error) {
        // Live refresh is optional; the server-rendered values remain valid.
      }
    }, 30000);
  };

  setupStudentCapture();
  setupAttendanceCapture();
  setupStudentSearch();
  setupTimeGreeting();
  setupHeaderBehavior();
  setupMobileNavigation();
  setupLiveStats();
})();
