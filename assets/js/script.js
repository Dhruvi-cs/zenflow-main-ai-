async function sendMessage() {
    const input = document.getElementById("message");
    if (!input) return;

    const text = input.value.trim();
    if (text === "") return;

    const body = document.getElementById("chatBody") || document.querySelector(".chat-body");
    if (!body) return;

    // Render user message
    const userDiv = document.createElement("div");
    userDiv.className = "user-message";
    userDiv.textContent = text;
    body.appendChild(userDiv);

    input.value = "";
    body.scrollTop = body.scrollHeight;

    // Render loading indicator
    const botDiv = document.createElement("div");
    botDiv.className = "bot-message";
    botDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Typing...';
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;

    try {
        const res = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });

        const data = await res.json();
        botDiv.textContent = data.reply || "Thank you! Your message has been received. Our AI assistant will help you shortly.";
    } catch (err) {
        botDiv.textContent = "Thank you! Your message has been received. Our AI assistant will help you shortly.";
    }

    body.scrollTop = body.scrollHeight;
}