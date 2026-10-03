import { useState } from "react";
import type { Application } from "@/domain/types";
import { useStore } from "@/lib/store";

export function ActionPlan({ application }: { application: Application }) {
  const { addTask, updateTask, removeTask, addSuggestedTasks } = useStore();
  const [taskLabel, setTaskLabel] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const completed = application.tasks.filter((task) => task.completed).length;
  return (
    <section className="atlas-action-plan" aria-labelledby={`plan-${application.id}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 id={`plan-${application.id}`} className="text-xl">
            Action plan
          </h2>
          <p className="text-xs text-muted-foreground">
            {completed} of {application.tasks.length} completed. Tasks never change application
            status.
          </p>
        </div>
        {application.tasks.length === 0 && (
          <button
            className="btn btn-outline btn-sm shrink-0"
            onClick={() => addSuggestedTasks(application.id)}
          >
            Add general steps
          </button>
        )}
      </div>
      {application.tasks.some((task) => task.suggested) && (
        <p className="mt-2 text-xs text-muted-foreground">
          General suggestions only — verify the provider's requirements.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {application.tasks.map((task) => (
          <li
            key={task.id}
            className="atlas-task-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-l-4 border-primary bg-muted p-3"
          >
            <input
              aria-label={`Mark ${task.label} complete`}
              className="w-auto"
              type="checkbox"
              checked={task.completed}
              onChange={(event) =>
                updateTask(application.id, task.id, { completed: event.target.checked })
              }
            />
            <div className="min-w-0">
              <input
                aria-label="Task name"
                className={task.completed ? "line-through" : ""}
                value={task.label}
                maxLength={120}
                onChange={(event) =>
                  updateTask(application.id, task.id, { label: event.target.value })
                }
              />
              <input
                aria-label={`Due date for ${task.label}`}
                className="mt-1"
                type="date"
                value={task.dueDate ?? ""}
                onChange={(event) =>
                  updateTask(application.id, task.id, { dueDate: event.target.value || null })
                }
              />
            </div>
            <button
              className="btn btn-ghost btn-sm shrink-0"
              aria-label={`Delete ${task.label}`}
              onClick={() => removeTask(application.id, task.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!taskLabel.trim()) return;
          addTask(application.id, { label: taskLabel, dueDate: taskDue || null, suggested: false });
          setTaskLabel("");
          setTaskDue("");
        }}
      >
        <label className="sr-only" htmlFor={`task-${application.id}`}>
          New task
        </label>
        <input
          id={`task-${application.id}`}
          value={taskLabel}
          maxLength={120}
          placeholder="Add your own task"
          onChange={(event) => setTaskLabel(event.target.value)}
        />
        <label className="sr-only" htmlFor={`task-date-${application.id}`}>
          Optional task due date
        </label>
        <input
          id={`task-date-${application.id}`}
          type="date"
          value={taskDue}
          onChange={(event) => setTaskDue(event.target.value)}
        />
        <button className="btn btn-outline" type="submit" disabled={!taskLabel.trim()}>
          Add task
        </button>
      </form>
    </section>
  );
}
