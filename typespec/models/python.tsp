namespace PGraph {
model PythonImplementation {
  language: "python";
  entrypoint: "run";
  code: string;
  @doc("Requested Python version (3.x or 3.x.y); omission means 3.12. Availability is validated by the future backend runner.")
  @pattern("^3\\.[0-9]+(?:\\.[0-9]+)?$")
  pythonVersion?: string = "3.12";
  @doc("Direct dependency declarations. Omission means []. MVP accepts package[extras]==version exact pins in canonical form; these declarations are not a resolved lockfile. Installation is the responsibility of the future backend runner.")
  requirements?: string[] = #[];
}

}
