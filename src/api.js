// Central place for backend calls. Change API_BASE if your
// server runs on a different host/port.
const API_BASE = "http://localhost:5000/api";

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export async function login({ role, id, password, captchaAnswer, captchaExpected }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, id, password, captchaAnswer, captchaExpected }),
  });
  return handle(res);
}

export async function fetchFacilities(type) {
  const url = type ? `${API_BASE}/facilities?type=${type}` : `${API_BASE}/facilities`;
  const res = await fetch(url);
  return handle(res);
}

//export async function submitEmergencyRequest(payload) {
  //const res = await fetch(`${API_BASE}/emergency-request`, {
   // method: "POST",
    //headers: { "Content-Type": "application/json" },
    //body: JSON.stringify(payload),
  //});
  //return handle(res);
//}
   export async function submitEmergencyRequest(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: "REQ-" + Date.now(),
        bloodGroup: payload.bloodGroup,
        unitsNeeded: payload.unitsNeeded,
        priority:
          payload.reason === "accident" ||
          payload.reason === "selfharm"
            ? "Critical"
            : payload.reason === "operation"
            ? "Scheduled"
            : "Moderate",

        status: "searching",

        facility: {
          name: "Apollo Hospital",
          city: "Coimbatore",
          location: "Coimbatore",
        },

        origin: {
          lat: 11.0168,
          lng: 76.9558,
        },

        facilityUser: null,
      });
    }, 500);
  });
}

export async function submitContactForm(payload) {
  const res = await fetch(`${API_BASE}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

//submiting data to the backend for the blood request form
    export async function searchNearbySources({
  bloodGroup,
  radiusKm,
}) {
  const data = [
    {
      id: 1,
      type: "hospital",
      name: "Apollo Hospital",
      location: "Coimbatore",
      distanceKm: 2.4,
      unitsAvailable: 12,
      bloodGroup: "A+",
      contact: {
        phone: "9876543210",
        email: "apollo@test.com",
      },
    },

    {
      id: 2,
      type: "bloodbank",
      name: "Red Cross Blood Bank",
      location: "Coimbatore",
      distanceKm: 5,
      unitsAvailable: 7,
      bloodGroup: "A+",
      contact: {
        phone: "9998887776",
        email: "redcross@test.com",
      },
    },

    {
      id: 3,
      type: "donor",
      name: "Arun Kumar",
      location: "Gandhipuram",
      distanceKm: 4,
      unitsAvailable: 1,
      bloodGroup: "A+",
      accepted: false,
      contact: {
        phone: "9000000000",
        email: "arun@gmail.com",
      },
    },

    {
      id: 4,
      type: "hospital",
      name: "Ganga Hospital",
      location: "Peelamedu",
      distanceKm: 9,
      unitsAvailable: 8,
      bloodGroup: "B+",
      contact: {
        phone: "8888888888",
        email: "ganga@test.com",
      },
    },
  ];

  return new Promise((resolve) => {
    setTimeout(() => {
      let result = data.filter(
        (x) => x.bloodGroup === bloodGroup
      );

      if (radiusKm !== 0) {
        result = result.filter(
          (x) => x.distanceKm <= radiusKm
        );
      }

      result.sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

      resolve(result);
    }, 700);
  });
}
