-- Store the path to the baseline DOM snapshot so runMonitor can load it for CSS diff
ALTER TABLE design_baselines
  ADD COLUMN baseline_dom_path TEXT NULL;
