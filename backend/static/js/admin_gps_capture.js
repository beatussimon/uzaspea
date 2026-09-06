/* Django Admin GPS Location Capture Tool */
document.addEventListener("DOMContentLoaded", function() {
    var latField = document.getElementById("id_latitude");
    var lngField = document.getElementById("id_longitude");

    if (!latField || !lngField) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button";
    btn.style.marginLeft = "12px";
    btn.style.padding = "5px 12px";
    btn.style.backgroundColor = "#f59e0b";
    btn.style.color = "#000";
    btn.style.fontWeight = "bold";
    btn.style.borderRadius = "6px";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.gap = "6px";
    btn.innerText = "📍 Capture Device GPS";

    btn.onclick = function() {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        btn.innerText = "⌛ Acquiring GPS...";
        btn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude.toFixed(6);
                var lng = pos.coords.longitude.toFixed(6);
                latField.value = lat;
                lngField.value = lng;
                
                var verifiedCheckbox = document.getElementById("id_is_location_verified");
                if (verifiedCheckbox) {
                    verifiedCheckbox.checked = true;
                }

                btn.innerText = "✓ GPS Captured (" + (pos.coords.accuracy ? pos.coords.accuracy.toFixed(0) + "m" : "High Acc") + ")";
                btn.style.backgroundColor = "#10b981";
                btn.style.color = "#fff";

                setTimeout(function() {
                    btn.innerText = "📍 Capture Device GPS";
                    btn.style.backgroundColor = "#f59e0b";
                    btn.style.color = "#000";
                    btn.disabled = false;
                }, 4000);
            },
            function(err) {
                alert("GPS Acquisition Error: " + err.message);
                btn.innerText = "📍 Capture Device GPS";
                btn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    latField.parentNode.appendChild(btn);
});
