import { Planner } from "../planner/planner";
export const metadata = { title: "Today" };
export default function Page() { return <Planner initialTab="today" />; }
