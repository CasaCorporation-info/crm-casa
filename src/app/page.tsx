export default function DashboardPage() {
  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ marginBottom: 30 }}>Dashboard</h1>

      <div style={gridStyle}>
        <StatBox title="Contatti in gestione" value="2893" />
        <StatBox title="Contatti lavorati" value="1293" />
        <StatBox title="Mai contattati" value="1600" />
        <StatBox title="Notizie trovate" value="45" />
        <StatBox title="Valutazioni fissate" value="12" />
        <StatBox title="Incarichi presi" value="9" />
        <StatBox title="Vendite fatte" value="1" />
      </div>

      <div style={{ marginTop: 40 }}>
        <div style={todayBox}>
          <h2 style={{ margin: 0 }}>Oggi hai contattato</h2>
          <p style={{ fontSize: 36, marginTop: 10 }}>0 persone</p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ title, value }: { title: string; value: string }) {
  return (
    <div style={boxStyle}>
      <p style={boxTitle}>{title}</p>
      <p style={boxValue}>{value}</p>
    </div>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
};

const boxStyle = {
  background: "#ffffff",
  borderRadius: 12,
  padding: 20,
  border: "1px solid #e5e5e5",
};

const boxTitle = {
  margin: 0,
  fontSize: 14,
  color: "#666",
};

const boxValue = {
  marginTop: 10,
  fontSize: 32,
  fontWeight: "bold",
};

const todayBox = {
  background: "#ffffff",
  borderRadius: 12,
  padding: 30,
  border: "1px solid #e5e5e5",
  maxWidth: 400,
};