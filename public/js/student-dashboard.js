// Add search state variable at the top
let isSearching = false;
let searchTimeout;
let currentSearchTerm = "";
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in
  if (!getToken()) {
    window.location.href = "/login.html";
    return;
  }

  setupNavigation();

  // Initialize the dashboard
  initializeDashboard();
});

function initializeDashboard() {
  // Navigation
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      // Reset search state when switching views
      isSearching = false;

      document
        .querySelectorAll(".nav-link")
        .forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      const viewId = link.dataset.view;
      document
        .querySelectorAll(".view")
        .forEach((view) => view.classList.remove("active"));
      document.getElementById(viewId).classList.add("active");

      // Load data when switching to specific views
      if (viewId === "searchBooks") {
        loadAllBooks();
      } else if (viewId === "issuedBooks") {
        loadIssuedBooks();
      } else if (viewId === "fines") {
        loadFines();
      }

      // Close mobile menu if open
      const mobileMenu = document.getElementById("mobileMenu");
      if (mobileMenu) {
        mobileMenu.classList.remove("active");
      }
    });
  });

  // Hamburger menu toggle
  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobileMenu");
  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
      mobileMenu.classList.toggle("active");
    });

    // Close mobile menu on outside click
    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove("active");
      }
    });
  }

  // Search functionality - IMPROVED VERSION
  // Search functionality - IMPROVED VERSION
  const searchInput = document.querySelector('#searchBooks input[type="text"]');

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchTerm = e.target.value;
      clearTimeout(searchTimeout);

      // Only search if there's actually a term, otherwise clear
      if (currentSearchTerm.trim()) {
        searchTimeout = setTimeout(() => {
          searchBooks(currentSearchTerm);
        }, 300);
      } else {
        // When search is cleared, show empty state or all books based on your preference
        const bookGrid = document.querySelector("#searchBooks .book-grid");
        if (bookGrid) {
          bookGrid.innerHTML =
            '<p class="no-books">Type to search for books...</p>';
        }
        isSearching = false;
      }
    });

    // Also add focusout/blur handler to prevent unwanted triggers
    searchInput.addEventListener("blur", () => {
      clearTimeout(searchTimeout);
    });
  }

  // Load books when page loads (if on searchBooks view)
  if (document.getElementById("searchBooks")?.classList.contains("active")) {
    loadAllBooks();
  }

  // Activate default view
  const activeNavLink = document.querySelector(".nav-link.active");
  if (activeNavLink) {
    activeNavLink.click();
  }

  // Add logout functionality to user avatar
  const userAvatar = document.querySelector(".user-avatar");
  if (userAvatar) {
    userAvatar.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Also make the profile link trigger logout for now
  const profileLink = document.querySelector('[data-view="profile"]');
  if (profileLink) {
    profileLink.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

function setupNavigation() {
  // Completely disable back navigation
  window.history.pushState(null, "", window.location.href);

  window.addEventListener("popstate", function (event) {
    // When back button is pressed, immediately go forward
    window.history.forward();

    // Optional: Show a subtle message
    console.log("Please use the logout button to exit");
  });
}

// Token management functions
async function getToken() {
  let token = localStorage.getItem("accessToken");

  if (!token) {
    console.log("No token found in storage");
    return null;
  }

  // Check if token is expired
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiry = payload.exp * 1000;
    if (Date.now() >= expiry - 60000) {
      console.log("Token expired or about to expire, refreshing...");
      token = await refreshAccessToken();
    }
  } catch (error) {
    console.error("Error parsing token:", error);
    return null;
  }

  return token;
}

async function refreshAccessToken() {
  try {
    const response = await fetch("/refresh", {
      method: "GET", // or GET if you added GET route
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Refresh token invalid or expired");
      logout();
      return null;
    }

    const data = await response.json();
    localStorage.setItem("accessToken", data.accessToken); // save new token
    return data.accessToken;
  } catch (err) {
    console.error("Error refreshing token:", err);
    logout();
    return null;
  }
}

async function makeAuthenticatedRequest(url, options = {}) {
  let token = await getToken();

  if (!token) {
    throw new Error("No authentication token available");
  }

  const config = {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  let response = await fetch(url, config);

  // If token is expired or invalid, try to refresh and retry once
  if (response.status === 403 || response.status === 401) {
    console.log("Access denied, attempting token refresh...");
    token = await refreshAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      response = await fetch(url, config);
    }
  }

  // If still unauthorized after refresh, handle it
  if (response.status === 403 || response.status === 401) {
    console.log("Still unauthorized after refresh, redirecting to login");
    logout();
    throw new Error("Authentication failed");
  }

  return response;
}

async function logout() {
  try {
    // COMPLETELY clear navigation handlers
    window.onpopstate = null;
    window.removeEventListener("popstate", handlePopState);

    // Clear all history states
    window.history.replaceState(null, "", "/login");

    await fetch("/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout API call failed:", error);
  } finally {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    localStorage.removeItem("user");

    // Force redirect without history
    window.location.replace("/login");
  }
}

// Function to load all books - ADD SEARCH STATE CHECK
async function loadAllBooks() {
  if (isSearching) {
    return; // Don't load all books if we're currently searching
  }
  try {
    console.log("🔄 Student: Starting loadAllBooks...");

    const bookGrid = document.querySelector("#searchBooks .book-grid");
    if (bookGrid) {
      bookGrid.innerHTML = '<div class="loading">Loading books...</div>';
    }

    console.log("🔄 Student: Making request to /api/students/books");
    const response = await makeAuthenticatedRequest("/api/students/books");

    console.log("🔄 Student: Response status:", response.status);
    console.log("🔄 Student: Response ok:", response.ok);

    if (!response.ok) {
      console.error("❌ Student: Failed to fetch books:", response.status);
      throw new Error(`Failed to fetch books: ${response.status}`);
    }

    const books = await response.json();
    console.log("✅ Student: Books received:", books);
    console.log("✅ Student: Number of books:", books.length);

    displayBooks(books);
  } catch (error) {
    console.error("❌ Student: Error loading books:", error);
    const bookGrid = document.querySelector("#searchBooks .book-grid");
    if (bookGrid) {
      bookGrid.innerHTML =
        '<p class="error">Error loading books. Please try refreshing the page.</p>';
    }
  }
}

// Function to search books
async function searchBooks(searchTerm) {
  try {
    const bookGrid = document.querySelector("#searchBooks .book-grid");

    if (!searchTerm.trim()) {
      isSearching = false;
      // Option 1: Keep current view (don't reload)
      // Option 2: Show a message to start searching
      if (bookGrid) {
        bookGrid.innerHTML =
          '<p class="no-books">Type to search for books...</p>';
      }
      return;
    }

    isSearching = true;

    if (bookGrid) {
      bookGrid.innerHTML = '<div class="loading">Searching books...</div>';
    }

    const response = await makeAuthenticatedRequest(
      `/api/students/books?search=${encodeURIComponent(searchTerm)}`
    );

    if (!response.ok) {
      throw new Error("Failed to search books");
    }

    const books = await response.json();
    displayBooks(books);
    isSearching = false;
  } catch (error) {
    console.error("Error searching books:", error);
    isSearching = false;
    const bookGrid = document.querySelector("#searchBooks .book-grid");
    if (bookGrid) {
      bookGrid.innerHTML =
        '<p class="error">Error searching books. Please try again.</p>';
    }
  }
}
// Function to display books in the grid
function displayBooks(books) {
  const bookGrid = document.querySelector("#searchBooks .book-grid");
  if (!bookGrid) return;

  if (!books || books.length === 0) {
    bookGrid.innerHTML =
      '<p class="no-books">No books found. Try a different search term.</p>';
    return;
  }

  bookGrid.innerHTML = books
    .map(
      (book) => `
    <div class="book-card available">
      <h3>${book.bookName || book.title || "Untitled Book"}</h3>
      <p>Author: ${book.authorName || book.author || "Unknown Author"}</p>
      <p>ISBN: ${book.isbn || book.bookID || "N/A"}</p>
      <p>Department: ${book.department || "General"}</p>
      <button class="request-issue" onclick="requestBook('${
        book.isbn || book.bookID
      }', '${book.bookName || book.title}', '${
        book.authorName || book.author
      }')">Request Issue</button>
    </div>
  `
    )
    .join("");
}

async function requestBook(bookId, bookTitle, bookAuthor) {
  try {
    console.log("📤 Requesting book:", bookId);

    const requestBody = {
      bookId: bookId,
    };

    console.log("📤 Sending request body:", requestBody);

    const response = await makeAuthenticatedRequest(
      "/api/students/issues/request",
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      }
    );

    console.log("📥 Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Server error:", errorText);

      let errorMessage = "Failed to request book";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }

      // Show specific error messages from backend
      if (errorMessage.includes("already have a request for this book")) {
        alert("❌ " + errorMessage);
      } else if (errorMessage.includes("already have 3 books")) {
        alert("❌ " + errorMessage);
      } else if (errorMessage.includes("Book is not available")) {
        alert("❌ " + errorMessage);
      } else {
        alert("❌ Error: " + errorMessage);
      }

      return; // Stop execution on error
    }

    const result = await response.json();
    console.log("✅ Success response:", result);

    alert("✅ " + (result.message || "Book requested successfully!"));
    loadAllBooks(); // Refresh the book list
  } catch (error) {
    console.error("💥 Error requesting book:", error);
    alert("❌ Error: " + error.message);
  }
}

// Functions for other views
async function loadIssuedBooks() {
  try {
    const response = await makeAuthenticatedRequest("/api/students/issues");

    if (!response.ok) {
      throw new Error("Failed to fetch issued books");
    }

    const issuedBooks = await response.json();
    displayIssuedBooks(issuedBooks);
  } catch (error) {
    console.error("Error loading issued books:", error);
    const issuedGrid = document.querySelector("#issuedBooks .issued-grid");
    if (issuedGrid) {
      issuedGrid.innerHTML = '<p class="error">Error loading issued books.</p>';
    }
  }
}

async function loadFines() {
  try {
    const finesSection = document.querySelector("#fines .fines-table tbody");
    if (finesSection) {
      finesSection.innerHTML = '<tr><td colspan="5">Loading fines...</td></tr>';
    }

    const response = await makeAuthenticatedRequest("/api/students/fines");

    if (!response.ok) {
      throw new Error("Failed to fetch fines");
    }

    const fines = await response.json();
    console.log("✅ Fines loaded:", fines);
    displayFines(fines);
  } catch (error) {
    console.error("Error loading fines:", error);
    const finesSection = document.querySelector("#fines .fines-table tbody");
    if (finesSection) {
      finesSection.innerHTML =
        '<tr><td colspan="5">Error loading fines. Please try again.</td></tr>';
    }
  }
}
function displayIssuedBooks(books) {
  const issuedGrid = document.querySelector("#issuedBooks .issued-grid");
  if (!issuedGrid) return;

  if (!books || books.length === 0) {
    issuedGrid.innerHTML = '<p class="no-books">No issued books found.</p>';
    return;
  }

  issuedGrid.innerHTML = books
    .map(
      (book) => `
    <div class="issued-card ${
      book.status === "overdue" ? "overdue" : "on-time"
    }">
      <h3>${book.bookTitle || "Unknown Book"}</h3>
      <p>by ${book.bookAuthor || "Unknown Author"}</p>
      <p>Issued On: ${book.issueDate}</p>
      <p>Due Date: ${book.dueDate}</p>
      <p class="days-overdue">${book.overdueDays || 0} days overdue</p>
      ${
        book.status === "overdue"
          ? `<p class="fine-amount">Fine: $${book.fineAmount || 0}</p>`
          : ""
      }
    </div>
  `
    )
    .join("");
}

function displayFines(fines) {
  const finesTable = document.querySelector("#fines .fines-table tbody");
  const overviewCards = document.querySelectorAll(
    ".fines-overview .overview-card"
  );

  if (!finesTable) return;

  if (!fines || fines.length === 0) {
    finesTable.innerHTML = '<tr><td colspan="5">No fines found.</td></tr>';

    // Update overview cards to show zero values
    if (overviewCards.length >= 3) {
      overviewCards[0].querySelector("p").textContent = "₹0.00"; // Total Unpaid
      overviewCards[1].querySelector("p").textContent = "0"; // Active Fines
      overviewCards[2].querySelector("p").textContent = "0"; // Paid Fines (you might need to adjust this logic)
    }

    // Update total amount
    const totalAmountElement = document.querySelector(".total-amount");
    if (totalAmountElement) {
      totalAmountElement.textContent = "₹0.00";
    }

    return;
  }

  // Calculate totals
  const totalUnpaid = fines.reduce(
    (sum, fine) => sum + (fine.fineAmount || 0),
    0
  );
  const activeFinesCount = fines.length;
  const paidFinesCount = 0; // You might want to track paid fines separately

  // Update overview cards
  if (overviewCards.length >= 3) {
    overviewCards[0].querySelector("p").textContent = `₹${totalUnpaid.toFixed(
      2
    )}`; // Total Unpaid
    overviewCards[1].querySelector("p").textContent =
      activeFinesCount.toString(); // Active Fines
    overviewCards[2].querySelector("p").textContent = paidFinesCount.toString(); // Paid Fines
  }

  // Update total amount display
  const totalAmountElement = document.querySelector(".total-amount");
  if (totalAmountElement) {
    totalAmountElement.textContent = `₹${totalUnpaid.toFixed(2)}`;
  }

  // Populate fines table
  finesTable.innerHTML = fines
    .map(
      (fine) => `
    <tr>
      <td>${fine.bookTitle || "Unknown Book"}</td>
      <td>${fine.dueDate || "N/A"}</td>
      <td>${fine.overdueDays || 0} days</td>
      <td>₹${fine.fineAmount || 0}</td>
      <td><span class="status-${fine.status === "paid" ? "paid" : "unpaid"}">${
        fine.status === "paid" ? "Paid" : "Unpaid"
      }</span></td>
    </tr>
  `
    )
    .join("");
}
