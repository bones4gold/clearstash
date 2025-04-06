const firebaseConfig = {
  apiKey: "AIzaSyC1W_WLCeEX5gDAhPgs_3oqoGFGU8bLDEA",
  authDomain: "clearstashchecker.firebaseapp.com",
  projectId: "clearstashchecker",
  storageBucket: "clearstashchecker.firebasestorage.app",
  messagingSenderId: "184792460468",
  appId: "1:184792460468:web:bdd87dc2a28f962fb07be1",
  measurementId: "G-YZ9DLXH427"
};

// ✅ Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 🌍 Grab DOM elements early
const regionSelect = document.getElementById("region");
const taskList = document.getElementById("task-list");

// ✅ Load available regions dynamically
const populateRegions = async () => {
  try {
    const snapshot = await db.collection("regions").get();
    regionSelect.innerHTML = '<option value="">Select a region</option>'; // reset options

    snapshot.forEach(doc => {
      const regionName = doc.id;
      const option = document.createElement("option");
      option.value = regionName;
      option.textContent = regionName.replace(/[-_]/g, ' ');
      regionSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading regions:", error);
  }
};

populateRegions();

// 🔄 Load tasks when region is selected
regionSelect.addEventListener("change", async () => {
  const region = regionSelect.value;
  if (!region) return;
  taskList.innerHTML = "<p>Loading tasks...</p>";

  try {
    const snapshot = await db.collection("regions").doc(region).collection("tasks").get();

    if (snapshot.empty) {
      taskList.innerHTML = "<p>No tasks found for this region.</p>";
      return;
    }

    taskList.innerHTML = "";
    snapshot.forEach((doc) => {
      const task = doc.data();
      const card = document.createElement("div");
      card.className = "task-card";

      card.innerHTML = `
        <h3>${task.taskName}</h3>
        <p><strong>What to do:</strong> ${task.taskDescription || "No description yet."}</p>
        <p><strong>Legal Info:</strong> ${task.legalInfo || "Not provided."}</p>
        ${task.referenceLink ? `<a href="${task.referenceLink}" target="_blank">View Document Template</a>` : ""}
        <textarea id="input-${doc.id}" placeholder="Paste your notes or explanation...">${task.submission || ""}</textarea>
        <input type="file" id="file-${doc.id}" />
        <button onclick="submitTask('${region}', '${doc.id}')">Submit</button>
        <p class="status">Status: ${task.status}</p>

        <div class="ai-box">
          <label for="ai-question-${doc.id}"><strong>Ask AI Assistant:</strong></label>
          <input type="text" id="ai-question-${doc.id}" placeholder="Ask a question..." />
          <button onclick="askAI('${doc.id}')">Ask</button>
          <p id="ai-response-${doc.id}" class="ai-response"></p>
        </div>
      `;

      taskList.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading tasks:", error);
    taskList.innerHTML = "<p>Error loading tasks. Check console for details.</p>";
  }
});

// ✅ Submission function
window.submitTask = async function(region, taskId) {
  const inputText = document.getElementById(`input-${taskId}`).value.trim();
  const userId = localStorage.getItem("userId") || generateUserId();

  const fileInput = document.getElementById(`file-${taskId}`);
  const file = fileInput?.files?.[0];

  try {
    let uploaded_docs = [];

    // 🔽 Upload file if one is selected
    if (file) {
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(`submissions/${userId}/${region}/${taskId}/${file.name}`);
      await fileRef.put(file);
      const fileUrl = await fileRef.getDownloadURL();
      uploaded_docs.push(fileUrl);
    }

    // 🔽 Save submission to Firestore
    const submissionRef = db
      .collection("submissions")
      .doc(userId)
      .collection(region.toLowerCase())
      .doc(`task_${taskId.replace('task', '')}`); // Converts "task1" → "task_1"

    await submissionRef.set({
      input_text: inputText,
      status: "pending",
      timestamp: new Date(),
      uploaded_docs
    });

    alert("Task submitted successfully!");
  } catch (error) {
    console.error("Error submitting task:", error);
    alert("Submission failed. Check console.");
  }
};

// ✅ Ask AI Function per task
window.askAI = async function(taskId) {
  const question = document.getElementById(`ai-question-${taskId}`).value.trim();
  const responseBox = document.getElementById(`ai-response-${taskId}`);

  if (!question) {
    responseBox.textContent = "Please enter a question.";
    return;
  }

  responseBox.textContent = "Thinking...";

  try {
    const res = await fetch("https://us-central1-clearstashchecker.cloudfunctions.net/askAssistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    responseBox.textContent = data.result || "No response.";
  } catch (err) {
    console.error("AI Error:", err);
    responseBox.textContent = "Error reaching assistant.";
  }
};

// ✅ Optional: generate temp user ID
function generateUserId() {
  const newId = 'user_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("userId", newId);
  return newId;
}
