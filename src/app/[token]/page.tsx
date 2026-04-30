type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function TestPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: 40,
        fontSize: 30,
      }}
    >
      TOKEN LETTO:
      <br />
      {token}
    </div>
  );
}