import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRestaurants from "./tools/list-restaurants";
import listReservations from "./tools/list-reservations";
import getReservation from "./tools/get-reservation";
import searchGuests from "./tools/search-guests";
import listWaitlist from "./tools/list-waitlist";
import addReservationNote from "./tools/add-reservation-note";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tx-tablewise",
  title: "TX TableWise",
  version: "0.1.0",
  instructions:
    "Tools for TX TableWise, a reservation and floor management system for restaurants. Use list_restaurants first when the user manages more than one venue. list_reservations and get_reservation read the booking agenda, search_guests reads the guest book, list_waitlist reads the waitlist, and add_reservation_note appends a staff-only note. All data is scoped to the signed-in user's restaurants.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRestaurants, listReservations, getReservation, searchGuests, listWaitlist, addReservationNote],
});
