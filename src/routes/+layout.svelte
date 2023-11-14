<script>
  import "terminal.css";
  import "../app.css";
  import "../prism-twilight.css"
</script>

<head>
  <title>BinayakD</title>
</head>

<div class="container">
  <div class="terminal-nav">
    <header class="terminal-logo">
      <div class="topnav">
        <div class="logo terminal-prompt">
          <a class="no-style" href="/">{"{"}{"{"} BinayakD {"}"}{"}"}</a>
        </div>
      </div>
    </header>
        
    <nav class="terminal-menu">
      <ul vocab="https://schema.org/" typeof="BreadcrumbList">
        <li property="itemListElement" typeof="ListItem">
          <a href="/" property="item" typeof="WebPage" class="menu-item">
            <span property="name">About</span>
          </a>
        </li>
        <li property="itemListElement" typeof="ListItem">

          <a href="https://github.com/binayakd" property="item" typeof="WebPage" class="menu-item" target="_blank" rel="noreferrer">
            <span property="name">Github</span>
          </a>
          <meta property="position" content="1">
          </li>
      </ul>
    </nav>
  
  </div>
</div>


<!-- <div class="nav-separator" /> -->
<div class="container">
  <main>
  <slot />
</main>

</div>

<!-- <div class="nav-separator" /> -->
<div class="container">
  <footer>
    <p>&copy; 2023 Binayak Dasgupta</p>
  </footer>
</div>


<!-- <style>
  .topnav {
    overflow: hidden;
    padding-top: 20px;
    padding-bottom: 20px;
    padding-right: 5px;
    padding-left: 5px;
    /* margin-top: 20px; */
    /* background-color: #333; */
  }

  .topnav a {
    float: left;
    color: #00ff00;
    text-align: center;
    padding: 14px 16px;
    text-decoration: none;
    font-size: 17px;
    text-shadow: none;
    transition: all 0.5s ease-in-out;
  }

  .topnav a:hover {
    /* background-color: #ddd;
  color: black; */
    text-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00,
      0 0 20px #00ff00, 0 0 35px #00ff00, 0 0 40px #00ff00, 0 0 50px #00ff00,
      0 0 75px #00ff00;
    transition: all 0.5s ease-in-out;
  }

  .topnav-right {
    float: right;
  }
  
  a.title {
    font-size: 25px;
  }
</style> -->
